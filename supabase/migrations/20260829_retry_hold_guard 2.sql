-- Restore the slot-hold guard on retry_payment_failed_booking.
--
-- 0039_kpay_failure_recovery.sql defined this RPC with a hold check that
-- returns reason='hold_expired' when any slot in the order is no longer held
-- by the user. 20260828_checkout_discounts.sql redefined the same function
-- (CREATE OR REPLACE) to add discount-reset columns but dropped that check, so
-- whichever migration ran last decides whether an expired hold can be retried.
-- app/api/checkout/retry/route.ts already maps 'hold_expired' to HTTP 409, so
-- the API contract expects the guard to exist.
--
-- This migration is the single source of truth for the function going forward:
-- discount reset (from 20260828) AND the hold guard (from 0039).
--
-- Also adds checkout_hold_expiry() so the UI can show how long a held slot
-- has left, and decide whether retry is still possible.
--
-- Safe to re-run: every statement is idempotent.

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
  v_invalid integer;
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

  IF v_booking.status NOT IN ('pending', 'payment_failed') THEN
    RETURN jsonb_build_object('success', false, 'reason', 'booking_not_retryable');
  END IF;

  v_group_id := v_booking.order_group_id;

  -- Every row in the order must belong to this user and still carry a slot.
  SELECT count(*) INTO v_invalid
    FROM public.bookings b
   WHERE ((v_group_id IS NULL AND b.id = v_booking.id)
       OR (v_group_id IS NOT NULL AND b.order_group_id = v_group_id))
     AND (b.user_id IS DISTINCT FROM p_user_id OR b.slot_id IS NULL);

  IF v_invalid > 0 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'booking_not_retryable');
  END IF;

  -- The hold guard: retrying re-creates a provider order against these slots,
  -- so they must still be locked by this user and not yet lapsed. Without this
  -- a user could pay for a slot another customer has since taken.
  SELECT count(*) INTO v_expired
    FROM public.bookings b
    LEFT JOIN public.slots s ON s.id = b.slot_id
   WHERE ((v_group_id IS NULL AND b.id = v_booking.id)
       OR (v_group_id IS NOT NULL AND b.order_group_id = v_group_id))
     AND (s.id IS NULL
       OR s.status <> 'locked'
       OR s.locked_by IS DISTINCT FROM p_user_id
       OR s.locked_until IS NULL
       OR s.locked_until <= now());

  IF v_expired > 0 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'hold_expired');
  END IF;

  -- Drop the failed provider order and reset checkout-scoped discounts so the
  -- retry re-prices from base. release_checkout_holds frees the promo/points
  -- holds that the abandoned attempt was still sitting on.
  PERFORM public.release_checkout_holds(p_booking_id, v_group_id);

  UPDATE public.bookings
     SET status = 'pending',
         payment_provider = NULL,
         provider_order_no = NULL,
         total_price = COALESCE(base_price, subtotal, total_price),
         promo_code_id = NULL,
         promo_code = NULL,
         promo_discount = 0,
         points_redeemed = 0,
         points_discount = 0,
         discount_snapshot = NULL,
         updated_at = now()
   WHERE ((v_group_id IS NULL AND id = p_booking_id)
       OR (v_group_id IS NOT NULL AND order_group_id = v_group_id))
     AND user_id = p_user_id
     AND status IN ('pending', 'payment_failed');

  RETURN jsonb_build_object(
    'success', true,
    'booking_id', p_booking_id,
    'order_group_id', v_group_id
  );
END;
$$;

-- ── checkout_hold_expiry ─────────────────────────────────────────────────────
-- Earliest slot-hold expiry across an order, so the recovery screen can show a
-- countdown and disable retry once the hold is gone. Read-only.

CREATE OR REPLACE FUNCTION public.checkout_hold_expiry(
  p_booking_id uuid,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group_id uuid;
  v_expires timestamptz;
  v_total integer;
  v_held integer;
BEGIN
  SELECT order_group_id INTO v_group_id
    FROM public.bookings
   WHERE id = p_booking_id AND user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  SELECT count(*),
         count(*) FILTER (
           WHERE s.status = 'locked'
             AND s.locked_by = p_user_id
             AND s.locked_until IS NOT NULL
             AND s.locked_until > now()
         ),
         min(s.locked_until) FILTER (
           WHERE s.status = 'locked' AND s.locked_by = p_user_id
         )
    INTO v_total, v_held, v_expires
    FROM public.bookings b
    LEFT JOIN public.slots s ON s.id = b.slot_id
   WHERE ((v_group_id IS NULL AND b.id = p_booking_id)
       OR (v_group_id IS NOT NULL AND b.order_group_id = v_group_id))
     AND b.user_id = p_user_id;

  RETURN jsonb_build_object(
    'found', true,
    'hold_active', v_total > 0 AND v_held = v_total,
    'expires_at', v_expires
  );
END;
$$;

REVOKE ALL ON FUNCTION public.retry_payment_failed_booking(uuid, uuid) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.checkout_hold_expiry(uuid, uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.retry_payment_failed_booking(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.checkout_hold_expiry(uuid, uuid) TO service_role;
