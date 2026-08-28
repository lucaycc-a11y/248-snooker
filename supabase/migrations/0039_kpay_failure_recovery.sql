-- KPay failure recovery.
-- A declined payment keeps the existing 15-minute slot hold so the customer can
-- retry the same booking. Explicit cancellation releases that hold immediately.
-- Run in the Supabase SQL Editor for wqmciwieiqvnswvspdyz.

DO $$
BEGIN
  ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
  ALTER TABLE public.bookings ADD CONSTRAINT bookings_status_check
    CHECK (status IN (
      'pending', 'confirmed', 'refunded', 'admin_cancelled',
      'payment_failed', 'cancelled', 'expired'
    ));
END $$;

-- Mark an active KPay decline without releasing the slot. The webhook event and
-- booking transition are committed together when called from the webhook.
CREATE OR REPLACE FUNCTION public.mark_kpay_payment_failed(
  p_booking_id uuid,
  p_event_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking public.bookings%rowtype;
  v_count integer;
  v_provider_order_no text;
BEGIN
  SELECT * INTO v_booking
    FROM public.bookings
   WHERE id = p_booking_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'booking_not_found');
  END IF;

  v_provider_order_no := v_booking.provider_order_no;

  IF v_booking.order_group_id IS NOT NULL THEN
    UPDATE public.bookings
       SET status = 'payment_failed', updated_at = now()
     WHERE order_group_id = v_booking.order_group_id
       AND status = 'pending';
    GET DIAGNOSTICS v_count = ROW_COUNT;
  ELSE
    UPDATE public.bookings
       SET status = 'payment_failed', updated_at = now()
     WHERE id = v_booking.id
       AND status = 'pending';
    GET DIAGNOSTICS v_count = ROW_COUNT;
  END IF;

  IF p_event_id IS NOT NULL THEN
    UPDATE public.webhook_events
       SET status = 'processed', processed_at = now()
     WHERE id = p_event_id;
  END IF;

  -- Mark payment attempt failed (non-fatal).
  IF v_provider_order_no IS NOT NULL THEN
    UPDATE public.payment_attempts
       SET status = 'failed', completed_at = now(), updated_at = now()
     WHERE provider_order_no = v_provider_order_no
       AND provider = 'kpay'
       AND status = 'pending';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'booking_id', v_booking.id,
    'updated_count', v_count
  );
END;
$$;

-- Reset a failed booking to pending only while every slot in the booking/group
-- is still held by the same user. Existing provider references are cleared so
-- checkout/create can issue a new order without creating a new booking row.
CREATE OR REPLACE FUNCTION public.retry_payment_failed_booking(
  p_booking_id uuid,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking public.bookings%rowtype;
  v_group_id uuid;
  v_missing integer;
  v_expired integer;
BEGIN
  SELECT * INTO v_booking
    FROM public.bookings
   WHERE id = p_booking_id
     AND user_id = p_user_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'booking_not_found');
  END IF;

  v_group_id := v_booking.order_group_id;

  -- A pending row with an existing order is safe to resume idempotently. A
  -- payment_failed row must lose its old provider order before retrying.
  IF v_booking.status NOT IN ('pending', 'payment_failed') THEN
    RETURN jsonb_build_object('success', false, 'reason', 'booking_not_retryable');
  END IF;

  SELECT count(*) INTO v_missing
    FROM public.bookings b
   WHERE ((v_group_id IS NULL AND b.id = v_booking.id)
       OR (v_group_id IS NOT NULL AND b.order_group_id = v_group_id))
     AND (b.user_id IS DISTINCT FROM p_user_id
       OR b.slot_id IS NULL);

  IF v_missing > 0 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'booking_not_retryable');
  END IF;

  SELECT count(*) INTO v_expired
    FROM public.bookings b
    LEFT JOIN public.slots s ON s.id = b.slot_id
   WHERE ((v_group_id IS NULL AND b.id = v_booking.id)
       OR (v_group_id IS NOT NULL AND b.order_group_id = v_group_id))
     AND (s.id IS NULL OR s.status <> 'locked'
       OR s.locked_by IS DISTINCT FROM p_user_id
       OR s.locked_until IS NULL
       OR s.locked_until <= now());

  IF v_expired > 0 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'hold_expired');
  END IF;

  UPDATE public.bookings
     SET status = 'pending',
         payment_provider = CASE WHEN v_booking.status = 'payment_failed' THEN NULL ELSE payment_provider END,
         provider_order_no = CASE WHEN v_booking.status = 'payment_failed' THEN NULL ELSE provider_order_no END,
         updated_at = now()
   WHERE ((v_group_id IS NULL AND id = v_booking.id)
       OR (v_group_id IS NOT NULL AND order_group_id = v_group_id))
     AND status IN ('pending', 'payment_failed');

  RETURN jsonb_build_object(
    'success', true,
    'booking_id', v_booking.id,
    'order_group_id', v_group_id
  );
END;
$$;

-- User cancellation is atomic: mark the booking/group cancelled and release all
-- held slots in the same transaction. It never touches a confirmed booking.
CREATE OR REPLACE FUNCTION public.cancel_pending_booking(
  p_booking_id uuid,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking public.bookings%rowtype;
  v_group_id uuid;
  v_cancelled integer;
  v_released integer;
BEGIN
  SELECT * INTO v_booking
    FROM public.bookings
   WHERE id = p_booking_id
     AND user_id = p_user_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'booking_not_found');
  END IF;
  IF v_booking.status NOT IN ('pending', 'payment_failed') THEN
    RETURN jsonb_build_object('success', false, 'reason', 'booking_not_cancellable');
  END IF;

  v_group_id := v_booking.order_group_id;

  UPDATE public.bookings
     SET status = 'cancelled', updated_at = now()
   WHERE ((v_group_id IS NULL AND id = v_booking.id)
       OR (v_group_id IS NOT NULL AND order_group_id = v_group_id))
     AND user_id = p_user_id
     AND status IN ('pending', 'payment_failed');
  GET DIAGNOSTICS v_cancelled = ROW_COUNT;

  WITH released AS (
    UPDATE public.slots s
       SET status = 'available', locked_by = NULL, locked_until = NULL
      FROM public.bookings b
     WHERE b.user_id = p_user_id
       AND ((v_group_id IS NULL AND b.id = v_booking.id)
         OR (v_group_id IS NOT NULL AND b.order_group_id = v_group_id))
       AND s.id = b.slot_id
       AND s.status = 'locked'
    RETURNING s.id
  )
  SELECT count(*) INTO v_released FROM released;

  -- Mark payment attempt cancelled (non-fatal).
  UPDATE public.payment_attempts
     SET status = 'cancelled', completed_at = now(), updated_at = now()
   WHERE booking_id = p_booking_id
     AND status IN ('claimed', 'pending');

  RETURN jsonb_build_object(
    'success', true,
    'booking_id', v_booking.id,
    'cancelled_count', v_cancelled,
    'released_count', v_released
  );
END;
$$;

REVOKE ALL ON FUNCTION public.mark_kpay_payment_failed(uuid, text) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.retry_payment_failed_booking(uuid, uuid) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.cancel_pending_booking(uuid, uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_kpay_payment_failed(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.retry_payment_failed_booking(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.cancel_pending_booking(uuid, uuid) TO service_role;
