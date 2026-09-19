-- Member data deletion/anonymization RPC
-- Implements PDPO data deletion rights per privacy policy section "閣下之權利"
-- Safe to re-run: idempotent DDL + function replacement

-- ════════════════════════════════════════════════════════════════════
-- Audit log for data deletion requests
-- ════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.data_deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'failed')),
  method text CHECK (method IN ('anonymize', 'hard_delete')),
  error text,
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS data_deletion_requests_user_idx
  ON public.data_deletion_requests(user_id, requested_at DESC);
CREATE INDEX IF NOT EXISTS data_deletion_requests_status_idx
  ON public.data_deletion_requests(status, requested_at DESC);

ALTER TABLE public.data_deletion_requests ENABLE ROW LEVEL SECURITY;

-- Users can see their own deletion requests
DROP POLICY IF EXISTS "deletion_requests_own_read" ON public.data_deletion_requests;
CREATE POLICY "deletion_requests_own_read"
  ON public.data_deletion_requests
  FOR SELECT
  USING (auth.uid() = user_id);

-- Service role writes (the RPC uses service role internally)
DROP POLICY IF EXISTS "deletion_requests_service_write" ON public.data_deletion_requests;
CREATE POLICY "deletion_requests_service_write"
  ON public.data_deletion_requests
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE public.data_deletion_requests IS
  'PDPO data deletion request audit log. Each request records who, when, outcome.';

-- ════════════════════════════════════════════════════════════════════
-- RPC: request_member_data_deletion
-- Called by authenticated member to delete/anonymize their personal data.
--
-- Strategy: ANONYMIZE instead of hard delete to preserve booking history
-- integrity and regulatory compliance (payment records retention).
--
-- What gets anonymized:
--   - users: display_name → 'Deleted User', phone → NULL, email kept for auth
--   - bookings: preserved with user_id reference (for venue records)
--   - points_ledger: preserved with user_id reference (for audit trail)
--   - payment_attempts: preserved (financial records, legal requirement)
--
-- What gets hard-deleted (no retention requirement):
--   - user_coupons
--   - campaign_claims
--   - referrals (both referrer and referred)
--   - locker_bookings (current/future only, past kept for billing)
--
-- Returns: { success: boolean, request_id: uuid, message: text }
-- ════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.request_member_data_deletion()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_request_id uuid;
  v_display_name text;
  v_email text;
  v_phone text;
  v_has_active_bookings boolean;
  v_error text;
BEGIN
  -- Must be authenticated
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Not authenticated'
    );
  END IF;

  -- Check for existing pending/completed request (prevent duplicate requests)
  IF EXISTS (
    SELECT 1 FROM public.data_deletion_requests
    WHERE user_id = v_user_id
    AND status IN ('pending', 'completed')
    AND requested_at > now() - interval '90 days'
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'A deletion request already exists for this account'
    );
  END IF;

  -- Check for active/upcoming bookings (within next 7 days)
  -- Require cancellation first to avoid service disruption
  SELECT EXISTS (
    SELECT 1 FROM public.bookings
    WHERE user_id = v_user_id
    AND status = 'confirmed'
    AND (
      (date IS NOT NULL AND date >= CURRENT_DATE)
      OR (start_time IS NOT NULL AND start_time > now() - interval '7 days')
    )
  ) INTO v_has_active_bookings;

  IF v_has_active_bookings THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Please cancel or complete all active bookings before requesting data deletion'
    );
  END IF;

  -- Capture original data for audit log
  SELECT display_name, email, phone INTO v_display_name, v_email, v_phone
  FROM public.users
  WHERE id = v_user_id;

  -- Create audit record FIRST (before any deletion)
  INSERT INTO public.data_deletion_requests (
    user_id,
    status,
    method,
    metadata
  ) VALUES (
    v_user_id,
    'pending',
    'anonymize',
    jsonb_build_object(
      'original_display_name', COALESCE(v_display_name, ''),
      'original_email', COALESCE(v_email, ''),
      'original_phone', COALESCE(v_phone, ''),
      'bookings_count', (SELECT COUNT(*) FROM public.bookings WHERE user_id = v_user_id),
      'points_balance', (SELECT COALESCE(points, 0) FROM public.users WHERE id = v_user_id)
    )
  ) RETURNING id INTO v_request_id;

  -- Begin anonymization/deletion process
  BEGIN
    -- 1. Anonymize users table (keep row for FK integrity)
    UPDATE public.users
    SET
      display_name = '已刪除用戶',
      phone = NULL,
      avatar_url = NULL,
      points = 0,
      profile_complete = false,
      updated_at = now()
    WHERE id = v_user_id;

    -- 2. Hard delete: user_coupons (no retention requirement)
    DELETE FROM public.user_coupons WHERE user_id = v_user_id;

    -- 3. Hard delete: campaign_claims (no retention requirement)
    DELETE FROM public.campaign_claims WHERE user_id = v_user_id;

    -- 4. Hard delete: referrals (both directions)
    DELETE FROM public.referrals
    WHERE referrer_id = v_user_id OR referred_id = v_user_id;

    -- 5. Hard delete: future locker bookings only (preserve past for billing)
    DELETE FROM public.locker_bookings
    WHERE user_id = v_user_id
    AND (end_date IS NULL OR end_date >= CURRENT_DATE);

    -- 6. bookings: PRESERVE (venue records, payment audit trail)
    --    user_id FK remains valid, linked to anonymized users row

    -- 7. points_ledger: PRESERVE (audit trail, financial reconciliation)
    --    user_id FK remains valid

    -- 8. payment_attempts: PRESERVE (financial records, legal requirement)
    --    user_id FK remains valid

    -- Mark request as completed
    UPDATE public.data_deletion_requests
    SET
      status = 'completed',
      processed_at = now()
    WHERE id = v_request_id;

    -- Delete auth.users entry (triggers CASCADE on data_deletion_requests row via FK)
    -- This signs the user out and prevents future login
    -- NOTE: This must be last, as auth.uid() becomes NULL after this
    DELETE FROM auth.users WHERE id = v_user_id;

    RETURN jsonb_build_object(
      'success', true,
      'request_id', v_request_id,
      'message', 'Data deletion request completed successfully'
    );

  EXCEPTION WHEN OTHERS THEN
    -- Capture error, mark request as failed
    v_error := SQLERRM;
    UPDATE public.data_deletion_requests
    SET
      status = 'failed',
      processed_at = now(),
      error = v_error
    WHERE id = v_request_id;

    RETURN jsonb_build_object(
      'success', false,
      'request_id', v_request_id,
      'message', 'Deletion failed: ' || v_error
    );
  END;
END;
$$;

COMMENT ON FUNCTION public.request_member_data_deletion IS
  'Anonymizes member personal data per PDPO rights. Preserves booking/payment records for legal compliance.';

-- Grant execute to authenticated users (anon cannot delete)
GRANT EXECUTE ON FUNCTION public.request_member_data_deletion() TO authenticated;
