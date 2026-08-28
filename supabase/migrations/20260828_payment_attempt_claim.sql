-- Payment attempt claim and finalization for KPay duplicate-order prevention.
-- Run in the Supabase SQL Editor for wqmciwieiqvnswvspdyz.
-- Safe to re-run: every statement is idempotent.

-- ── RPC: claim_payment_attempt ────────────────────────────────────────────────
-- Atomically claim a payment attempt slot before calling the external provider.
-- Returns an existing active attempt if one exists, preventing duplicate orders.
-- Called by checkout/create before provider.createOrder().

CREATE OR REPLACE FUNCTION public.claim_payment_attempt(
  p_booking_id uuid,
  p_user_id uuid,
  p_provider text,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing public.payment_attempts%rowtype;
  v_new_id uuid;
  v_order_group_id uuid;
BEGIN
  -- Check for an existing active attempt on this booking.
  SELECT * INTO v_existing
    FROM public.payment_attempts
   WHERE booking_id = p_booking_id
     AND status IN ('claimed', 'pending')
   LIMIT 1;

  IF FOUND THEN
    -- Return the existing attempt — the caller should use its provider_order_no
    -- if present, or proceed with creating an order if it's still 'claimed'.
    RETURN jsonb_build_object(
      'success', true,
      'attempt_id', v_existing.id,
      'provider_order_no', v_existing.provider_order_no,
      'existing', true
    );
  END IF;

  -- Load order_group_id from the booking for group tracking.
  SELECT order_group_id INTO v_order_group_id
    FROM public.bookings
   WHERE id = p_booking_id
     AND user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'booking_not_found');
  END IF;

  -- Claim a new attempt.
  v_new_id := gen_random_uuid();

  INSERT INTO public.payment_attempts (
    id,
    booking_id,
    order_group_id,
    user_id,
    provider,
    status,
    idempotency_key,
    created_at,
    updated_at
  ) VALUES (
    v_new_id,
    p_booking_id,
    v_order_group_id,
    p_user_id,
    p_provider,
    'claimed',
    p_idempotency_key,
    now(),
    now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'attempt_id', v_new_id,
    'provider_order_no', NULL,
    'existing', false
  );
END;
$$;

COMMENT ON FUNCTION public.claim_payment_attempt IS
  'Atomically claim a payment attempt before calling the provider. Returns existing active attempt if present.';

-- ── RPC: finalize_payment_attempt ─────────────────────────────────────────────
-- Record the provider order number after a successful external order creation.
-- Called by checkout/create after provider.createOrder() returns.

CREATE OR REPLACE FUNCTION public.finalize_payment_attempt(
  p_attempt_id uuid,
  p_provider_order_no text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated integer;
BEGIN
  UPDATE public.payment_attempts
     SET provider_order_no = p_provider_order_no,
         status = 'pending',
         updated_at = now()
   WHERE id = p_attempt_id
     AND status = 'claimed';

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 0 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'attempt_not_claimable');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

COMMENT ON FUNCTION public.finalize_payment_attempt IS
  'Record provider order number after successful external order creation.';

-- ── RPC: fail_payment_attempt ─────────────────────────────────────────────────
-- Mark a payment attempt as failed when the external provider call fails.
-- Called by checkout/create when provider.createOrder() throws.

CREATE OR REPLACE FUNCTION public.fail_payment_attempt(
  p_attempt_id uuid,
  p_failure_code text DEFAULT NULL,
  p_failure_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.payment_attempts
     SET status = 'failed',
         failure_code = p_failure_code,
         failure_reason = p_failure_reason,
         completed_at = now(),
         updated_at = now()
   WHERE id = p_attempt_id
     AND status IN ('claimed', 'pending');

  RETURN jsonb_build_object('success', true);
END;
$$;

COMMENT ON FUNCTION public.fail_payment_attempt IS
  'Mark attempt as failed when provider call fails or payment is declined.';

-- ── RPC: complete_payment_attempt ─────────────────────────────────────────────
-- Mark a payment attempt as succeeded when the webhook confirms the booking.
-- Called by webhooks/kpay when handleSucceeded completes.

CREATE OR REPLACE FUNCTION public.complete_payment_attempt(
  p_provider_order_no text,
  p_provider text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.payment_attempts
     SET status = 'succeeded',
         completed_at = now(),
         updated_at = now()
   WHERE provider_order_no = p_provider_order_no
     AND provider = p_provider
     AND status = 'pending';

  RETURN jsonb_build_object('success', true);
END;
$$;

COMMENT ON FUNCTION public.complete_payment_attempt IS
  'Mark attempt as succeeded when webhook confirms payment.';

-- ── RPC: cancel_payment_attempt ──────────────────────────────────────────────
-- Mark a payment attempt as cancelled when the user cancels the booking.
-- Called by cancel_pending_booking.

CREATE OR REPLACE FUNCTION public.cancel_payment_attempt(
  p_booking_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.payment_attempts
     SET status = 'cancelled',
         completed_at = now(),
         updated_at = now()
   WHERE booking_id = p_booking_id
     AND status IN ('claimed', 'pending');

  RETURN jsonb_build_object('success', true);
END;
$$;

COMMENT ON FUNCTION public.cancel_payment_attempt IS
  'Mark attempt as cancelled when user cancels the booking.';

-- ── Permissions ───────────────────────────────────────────────────────────────

REVOKE ALL ON FUNCTION public.claim_payment_attempt(uuid, uuid, text, text) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.finalize_payment_attempt(uuid, text) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.fail_payment_attempt(uuid, text, text) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_payment_attempt(text, text) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.cancel_payment_attempt(uuid) FROM public, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.claim_payment_attempt(uuid, uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.finalize_payment_attempt(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_payment_attempt(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_payment_attempt(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.cancel_payment_attempt(uuid) TO service_role;
