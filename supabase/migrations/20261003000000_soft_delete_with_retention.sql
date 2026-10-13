-- Soft delete with 6-month retention and duplicate registration prevention
-- Replaces immediate hard-delete with time-delayed cleanup

-- ════════════════════════════════════════════════════════════════════
-- deleted_users table: 6-month retention for deleted user identities
-- ════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.deleted_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email text NOT NULL,
  phone text,
  apple_id text,
  deleted_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '6 months'),
  metadata jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT deleted_users_expires_at_check CHECK (expires_at > deleted_at)
);

CREATE INDEX IF NOT EXISTS deleted_users_email_idx ON public.deleted_users(email) WHERE expires_at > now();
CREATE INDEX IF NOT EXISTS deleted_users_phone_idx ON public.deleted_users(phone) WHERE phone IS NOT NULL AND expires_at > now();
CREATE INDEX IF NOT EXISTS deleted_users_apple_id_idx ON public.deleted_users(apple_id) WHERE apple_id IS NOT NULL AND expires_at > now();
CREATE INDEX IF NOT EXISTS deleted_users_expires_at_idx ON public.deleted_users(expires_at) WHERE expires_at <= now();

COMMENT ON TABLE public.deleted_users IS
  'Stores deleted user identities for 6 months to prevent duplicate registration during retention period. Cleaned up automatically via pg_cron.';

COMMENT ON COLUMN public.deleted_users.user_id IS 'Original auth.users.id before deletion';
COMMENT ON COLUMN public.deleted_users.email IS 'Email identity - blocks registration during retention period';
COMMENT ON COLUMN public.deleted_users.phone IS 'Phone identity - blocks registration during retention period';
COMMENT ON COLUMN public.deleted_users.apple_id IS 'Apple ID identity - blocks registration during retention period';
COMMENT ON COLUMN public.deleted_users.expires_at IS 'When this record expires and can be permanently deleted (6 months after deletion)';

-- No RLS needed - this table is accessed only by service role via RPC and registration checks

-- ════════════════════════════════════════════════════════════════════
-- Update request_member_data_deletion to soft-delete
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
  v_apple_id text;
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

  -- Capture original data for audit log and deleted_users table
  SELECT display_name, email, phone INTO v_display_name, v_email, v_phone
  FROM public.users
  WHERE id = v_user_id;

  -- Get Apple ID if exists (from auth.identities)
  SELECT identifier INTO v_apple_id
  FROM auth.identities
  WHERE user_id = v_user_id
  AND provider = 'apple'
  LIMIT 1;

  -- Create audit record FIRST (before any deletion)
  INSERT INTO public.data_deletion_requests (
    user_id,
    status,
    method,
    metadata
  ) VALUES (
    v_user_id,
    'pending',
    'soft_delete',
    jsonb_build_object(
      'original_display_name', COALESCE(v_display_name, ''),
      'original_email', COALESCE(v_email, ''),
      'original_phone', COALESCE(v_phone, ''),
      'original_apple_id', COALESCE(v_apple_id, ''),
      'bookings_count', (SELECT COUNT(*) FROM public.bookings WHERE user_id = v_user_id),
      'points_balance', (SELECT COALESCE(points, 0) FROM public.users WHERE id = v_user_id)
    )
  ) RETURNING id INTO v_request_id;

  -- Begin soft-delete process
  BEGIN
    -- 1. Store user identities in deleted_users (6-month retention)
    INSERT INTO public.deleted_users (
      user_id,
      email,
      phone,
      apple_id,
      metadata
    ) VALUES (
      v_user_id,
      v_email,
      v_phone,
      v_apple_id,
      jsonb_build_object(
        'display_name', v_display_name,
        'deleted_via', 'member_request',
        'request_id', v_request_id
      )
    );

    -- 2. Anonymize users table (keep row for FK integrity)
    UPDATE public.users
    SET
      display_name = '已刪除用戶',
      phone = NULL,
      avatar_url = NULL,
      points = 0,
      profile_complete = false,
      deleted_at = now(),
      updated_at = now()
    WHERE id = v_user_id;

    -- 3. Hard delete: user_coupons (no retention requirement)
    DELETE FROM public.user_coupons WHERE user_id = v_user_id;

    -- 4. Hard delete: campaign_claims (no retention requirement)
    DELETE FROM public.campaign_claims WHERE user_id = v_user_id;

    -- 5. Hard delete: referrals (both directions)
    DELETE FROM public.referrals
    WHERE referrer_id = v_user_id OR referred_id = v_user_id;

    -- 6. Hard delete: future locker bookings only (preserve past for billing)
    DELETE FROM public.locker_bookings
    WHERE user_id = v_user_id
    AND (end_date IS NULL OR end_date >= CURRENT_DATE);

    -- 7. Disable auth.users (keep record but prevent login)
    --    Set email_confirmed_at = NULL to disable login
    --    The record stays for 6 months, then gets hard-deleted by pg_cron
    UPDATE auth.users
    SET
      email_confirmed_at = NULL,
      phone_confirmed_at = NULL,
      banned_until = (now() + interval '6 months'),
      updated_at = now()
    WHERE id = v_user_id;

    -- 8. bookings: PRESERVE (venue records, payment audit trail)
    -- 9. points_ledger: PRESERVE (audit trail, financial reconciliation)
    -- 10. payment_attempts: PRESERVE (financial records, legal requirement)

    -- Mark request as completed
    UPDATE public.data_deletion_requests
    SET
      status = 'completed',
      processed_at = now()
    WHERE id = v_request_id;

    RETURN jsonb_build_object(
      'success', true,
      'request_id', v_request_id,
      'message', 'Data deletion request completed successfully. Account will be permanently deleted after 6 months.'
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
  'Soft-deletes member data with 6-month retention. Preserves booking/payment records for legal compliance. Final hard-delete happens via pg_cron after retention period.';

-- ════════════════════════════════════════════════════════════════════
-- Helper function: check if identity is in retention period
-- ════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.is_identity_deleted(
  p_provider text,
  p_identifier text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.deleted_users
    WHERE expires_at > now()
    AND (
      (p_provider = 'email' AND email = p_identifier)
      OR (p_provider = 'phone' AND phone = p_identifier)
      OR (p_provider = 'apple' AND apple_id = p_identifier)
    )
  );
$$;

COMMENT ON FUNCTION public.is_identity_deleted IS
  'Checks if an identity (email/phone/apple_id) is in the 6-month retention period after deletion. Returns true if identity cannot be re-registered yet.';

GRANT EXECUTE ON FUNCTION public.is_identity_deleted TO authenticated, anon;

-- ════════════════════════════════════════════════════════════════════
-- Cleanup function for pg_cron
-- ════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.cleanup_expired_deleted_users()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expired_user_ids uuid[];
  v_deleted_count int;
BEGIN
  -- Get expired user_ids
  SELECT array_agg(user_id)
  INTO v_expired_user_ids
  FROM public.deleted_users
  WHERE expires_at <= now();

  -- Hard delete from auth.users
  IF v_expired_user_ids IS NOT NULL AND array_length(v_expired_user_ids, 1) > 0 THEN
    DELETE FROM auth.users
    WHERE id = ANY(v_expired_user_ids);

    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

    RAISE NOTICE 'Permanently deleted % auth.users records', v_deleted_count;
  END IF;

  -- Delete expired records from deleted_users
  DELETE FROM public.deleted_users
  WHERE expires_at <= now();

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RAISE NOTICE 'Cleaned up % expired deleted_users records', v_deleted_count;
END;
$$;

COMMENT ON FUNCTION public.cleanup_expired_deleted_users IS
  'Cleanup function for pg_cron: permanently deletes expired deleted_users records and their corresponding auth.users accounts after 6-month retention period.';

-- ════════════════════════════════════════════════════════════════════
-- pg_cron job: schedule daily cleanup at 2 AM UTC
-- ════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  -- Check if pg_cron extension exists
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Remove existing job if it exists
    PERFORM cron.unschedule('cleanup_expired_deleted_users');

    -- Schedule new job
    PERFORM cron.schedule(
      'cleanup_expired_deleted_users',
      '0 2 * * *', -- Daily at 2 AM UTC
      'SELECT public.cleanup_expired_deleted_users();'
    );

    RAISE NOTICE 'pg_cron job "cleanup_expired_deleted_users" scheduled successfully';
  ELSE
    RAISE WARNING 'pg_cron extension not installed - automatic cleanup will not run. Install pg_cron or run cleanup manually.';
  END IF;
END;
$$;
