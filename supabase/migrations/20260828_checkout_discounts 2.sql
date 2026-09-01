-- 248 Snooker — authoritative checkout discounts and points holds.
-- Run in the Supabase SQL Editor for project wqmciwieiqvnswvspdyz.
--
-- This migration deliberately evolves promotion_codes and the existing booking
-- RPCs. Prices are stored in the booking rows before a provider order is made;
-- callers never submit a final amount to any confirmation function.

-- ════════════════════════════════════════════════════════════════════════════
-- 1. Schema: snapshots and server-side reservations
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.promotion_codes
  ADD COLUMN IF NOT EXISTS max_discount numeric,
  ADD COLUMN IF NOT EXISTS per_user_limit integer;

ALTER TABLE public.promotion_codes
  DROP CONSTRAINT IF EXISTS promotion_codes_discount_value_check;
ALTER TABLE public.promotion_codes
  ADD CONSTRAINT promotion_codes_discount_value_check
  CHECK (discount_value >= 0);

ALTER TABLE public.promotion_codes
  DROP CONSTRAINT IF EXISTS promotion_codes_max_discount_check;
ALTER TABLE public.promotion_codes
  ADD CONSTRAINT promotion_codes_max_discount_check
  CHECK (max_discount IS NULL OR max_discount >= 0);

ALTER TABLE public.promotion_codes
  DROP CONSTRAINT IF EXISTS promotion_codes_per_user_limit_check;
ALTER TABLE public.promotion_codes
  ADD CONSTRAINT promotion_codes_per_user_limit_check
  CHECK (per_user_limit IS NULL OR per_user_limit > 0);

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS base_price integer,
  ADD COLUMN IF NOT EXISTS subtotal integer,
  ADD COLUMN IF NOT EXISTS promo_code_id uuid,
  ADD COLUMN IF NOT EXISTS promo_code text,
  ADD COLUMN IF NOT EXISTS promo_discount integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS points_redeemed integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS points_discount integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_snapshot jsonb;

-- Existing total_price already includes the configured member/tier price. It is
-- the pre-checkout subtotal for old rows; new checkout preparation always starts
-- from base_price and never from a client cart total.
UPDATE public.bookings
   SET base_price = COALESCE(base_price, total_price),
       subtotal = COALESCE(subtotal, total_price)
 WHERE base_price IS NULL OR subtotal IS NULL;

CREATE INDEX IF NOT EXISTS bookings_promo_code_idx
  ON public.bookings (promo_code_id)
  WHERE promo_code_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.promo_code_usages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_code_id uuid NOT NULL REFERENCES public.promotion_codes(id) ON DELETE RESTRICT,
  booking_id uuid NOT NULL,
  order_group_id uuid,
  user_id uuid NOT NULL,
  checkout_key text NOT NULL UNIQUE,
  discount_amount integer NOT NULL CHECK (discount_amount >= 0),
  status text NOT NULL DEFAULT 'held'
    CHECK (status IN ('held', 'redeemed', 'released')),
  held_at timestamptz NOT NULL DEFAULT now(),
  redeemed_at timestamptz,
  released_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS promo_code_usages_promo_status_idx
  ON public.promo_code_usages (promo_code_id, status);
CREATE INDEX IF NOT EXISTS promo_code_usages_user_idx
  ON public.promo_code_usages (user_id, promo_code_id, status);

ALTER TABLE public.promo_code_usages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS promo_code_usages_select_service ON public.promo_code_usages;
DROP POLICY IF EXISTS promo_code_usages_insert_service ON public.promo_code_usages;
DROP POLICY IF EXISTS promo_code_usages_update_service ON public.promo_code_usages;
DROP POLICY IF EXISTS promo_code_usages_delete_service ON public.promo_code_usages;
CREATE POLICY promo_code_usages_select_service ON public.promo_code_usages FOR SELECT
  USING (auth.role() = 'service_role');
CREATE POLICY promo_code_usages_insert_service ON public.promo_code_usages FOR INSERT
  WITH CHECK (auth.role() = 'service_role');
CREATE POLICY promo_code_usages_update_service ON public.promo_code_usages FOR UPDATE
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY promo_code_usages_delete_service ON public.promo_code_usages FOR DELETE
  USING (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS public.points_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL,
  order_group_id uuid,
  user_id uuid NOT NULL,
  checkout_key text NOT NULL UNIQUE,
  points integer NOT NULL CHECK (points > 0),
  discount_amount integer NOT NULL CHECK (discount_amount >= 0),
  status text NOT NULL DEFAULT 'held'
    CHECK (status IN ('held', 'redeemed', 'released')),
  held_at timestamptz NOT NULL DEFAULT now(),
  redeemed_at timestamptz,
  released_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS points_holds_user_status_idx
  ON public.points_holds (user_id, status);

ALTER TABLE public.points_holds ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS points_holds_select_service ON public.points_holds;
DROP POLICY IF EXISTS points_holds_insert_service ON public.points_holds;
DROP POLICY IF EXISTS points_holds_update_service ON public.points_holds;
DROP POLICY IF EXISTS points_holds_delete_service ON public.points_holds;
CREATE POLICY points_holds_select_service ON public.points_holds FOR SELECT
  USING (auth.role() = 'service_role');
CREATE POLICY points_holds_insert_service ON public.points_holds FOR INSERT
  WITH CHECK (auth.role() = 'service_role');
CREATE POLICY points_holds_update_service ON public.points_holds FOR UPDATE
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY points_holds_delete_service ON public.points_holds FOR DELETE
  USING (auth.role() = 'service_role');

INSERT INTO public.config (key, value)
VALUES (
  'points_redemption',
  '[{"points":100,"discount":5},{"points":500,"discount":30}]'::jsonb
)
ON CONFLICT (key) DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════════
-- 2. Promotion preview. The two-argument form remains for compatibility, but
-- the checkout routes use the user-aware three-argument form.
-- ════════════════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.validate_promotion_code(text, numeric);
CREATE OR REPLACE FUNCTION public.validate_promotion_code(
  p_code text,
  p_cart_amount numeric DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  RETURN public.validate_promotion_code(upper(trim(p_code)), p_cart_amount, auth.uid());
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_promotion_code(
  p_code text,
  p_cart_amount numeric,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_promo public.promotion_codes%ROWTYPE;
  v_used integer;
  v_user_used integer;
  v_discount numeric;
  v_final numeric;
BEGIN
  IF p_code IS NULL OR length(trim(p_code)) = 0 OR p_cart_amount < 0 THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'invalid');
  END IF;

  SELECT * INTO v_promo
    FROM public.promotion_codes
   WHERE code = upper(trim(p_code));
  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'invalid');
  END IF;
  IF NOT v_promo.is_active THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'inactive');
  END IF;
  IF v_promo.valid_from > now() THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'not_started', 'valid_from', v_promo.valid_from);
  END IF;
  IF v_promo.valid_until IS NOT NULL AND v_promo.valid_until <= now() THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'expired');
  END IF;

  SELECT count(*)::integer INTO v_used
    FROM public.promo_code_usages u
   WHERE u.promo_code_id = v_promo.id AND u.status IN ('held', 'redeemed');
  v_used := greatest(v_used, COALESCE(v_promo.used_count, 0));
  IF v_promo.max_uses IS NOT NULL AND v_used >= v_promo.max_uses THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'usage_limit_reached');
  END IF;

  IF p_user_id IS NOT NULL THEN
    SELECT count(*)::integer INTO v_user_used
      FROM public.promo_code_usages u
     WHERE u.promo_code_id = v_promo.id
       AND u.user_id = p_user_id
       AND u.status IN ('held', 'redeemed');
    IF v_promo.per_user_limit IS NOT NULL AND v_user_used >= v_promo.per_user_limit THEN
      RETURN jsonb_build_object('valid', false, 'reason', 'user_limit_reached');
    END IF;
  END IF;

  IF v_promo.min_cart_amount IS NOT NULL AND p_cart_amount < v_promo.min_cart_amount THEN
    RETURN jsonb_build_object(
      'valid', false, 'reason', 'min_order_not_met',
      'min_cart_amount', v_promo.min_cart_amount
    );
  END IF;

  IF v_promo.discount_type = 'percentage' THEN
    v_discount := round(p_cart_amount * v_promo.discount_value / 100, 0);
    IF v_promo.max_discount IS NOT NULL THEN
      v_discount := least(v_discount, v_promo.max_discount);
    END IF;
  ELSE
    v_discount := v_promo.discount_value;
  END IF;
  v_discount := greatest(0, least(v_discount, p_cart_amount));
  v_final := greatest(0, p_cart_amount - v_discount);

  RETURN jsonb_build_object(
    'valid', true,
    'promo_code_id', v_promo.id,
    'code', v_promo.code,
    'discount_type', v_promo.discount_type,
    'discount_value', v_promo.discount_value,
    'max_discount', v_promo.max_discount,
    'discount_amount', v_discount,
    'final_amount', v_final
  );
END;
$$;

REVOKE ALL ON FUNCTION public.validate_promotion_code(text, numeric) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_promotion_code(text, numeric, uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_promotion_code(text, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.validate_promotion_code(text, numeric, uuid) TO service_role;

-- ════════════════════════════════════════════════════════════════════════════
-- 3. Shared reservation helpers
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.release_checkout_holds(
  p_booking_id uuid,
  p_order_group_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key text;
  v_released integer := 0;
BEGIN
  v_key := CASE WHEN p_order_group_id IS NULL
    THEN 'booking:' || p_booking_id::text
    ELSE 'group:' || p_order_group_id::text END;

  UPDATE public.promo_code_usages
     SET status = 'released', released_at = now()
   WHERE checkout_key = v_key AND status = 'held';
  GET DIAGNOSTICS v_released = ROW_COUNT;

  UPDATE public.points_holds
     SET status = 'released', released_at = now()
   WHERE checkout_key = v_key AND status = 'held';

  RETURN jsonb_build_object('success', true, 'released_promos', v_released);
END;
$$;

CREATE OR REPLACE FUNCTION public.prepare_checkout(
  p_booking_id uuid,
  p_user_id uuid,
  p_promo_code text DEFAULT NULL,
  p_points integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking public.bookings%rowtype;
  v_row public.bookings%rowtype;
  v_group_id uuid;
  v_key text;
  v_user_points integer;
  v_held_points integer;
  v_rule jsonb;
  v_points_discount integer;
  v_subtotal integer := 0;
  v_discount integer := 0;
  v_remaining_discount integer := 0;
  v_remaining_subtotal integer := 0;
  v_alloc integer;
  v_count integer := 0;
  v_promo public.promotion_codes%rowtype;
  v_used integer;
  v_user_used integer;
  v_promo_discount numeric;
  v_promo_id uuid;
  v_selection jsonb;
BEGIN
  SELECT * INTO v_booking
    FROM public.bookings
   WHERE id = p_booking_id AND user_id = p_user_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'booking_not_found');
  END IF;
  IF v_booking.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'booking_not_pending');
  END IF;

  v_group_id := v_booking.order_group_id;
  v_key := CASE WHEN v_group_id IS NULL
    THEN 'booking:' || p_booking_id::text
    ELSE 'group:' || v_group_id::text END;

  -- Lock every row in the transaction boundary and derive the subtotal only
  -- from rows owned by this user.
  FOR v_row IN
    SELECT * FROM public.bookings
     WHERE ((v_group_id IS NULL AND id = p_booking_id)
        OR (v_group_id IS NOT NULL AND order_group_id = v_group_id))
       AND user_id = p_user_id
     ORDER BY date, start_time, id
     FOR UPDATE
  LOOP
    v_count := v_count + 1;
    v_subtotal := v_subtotal + COALESCE(v_row.base_price, v_row.subtotal, v_row.total_price, 0);
  END LOOP;
  IF v_count = 0 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'booking_not_found');
  END IF;

  IF p_promo_code IS NOT NULL AND length(trim(p_promo_code)) > 0 AND p_points > 0 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'discounts_mutually_exclusive');
  END IF;
  IF p_points < 0 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_points');
  END IF;

  -- A provider order already stamped means its discount selection is immutable.
  IF v_booking.provider_order_no IS NOT NULL THEN
    v_selection := v_booking.discount_snapshot;
    IF (p_promo_code IS NULL OR length(trim(p_promo_code)) = 0)
       AND p_points = 0
       AND COALESCE((v_selection->>'kind'), 'none') <> 'none' THEN
      RETURN jsonb_build_object('success', false, 'reason', 'discount_selection_locked');
    END IF;
    IF p_points > 0 AND COALESCE((v_selection->>'points')::integer, 0) <> p_points THEN
      RETURN jsonb_build_object('success', false, 'reason', 'discount_selection_locked');
    END IF;
    IF p_promo_code IS NOT NULL AND upper(trim(p_promo_code)) <> COALESCE(v_selection->>'code', '') THEN
      RETURN jsonb_build_object('success', false, 'reason', 'discount_selection_locked');
    END IF;
    RETURN jsonb_build_object(
      'success', true, 'subtotal', v_subtotal,
      'discount_amount', COALESCE(v_booking.promo_discount, 0) + COALESCE(v_booking.points_discount, 0),
      'total', v_booking.total_price,
      'kind', COALESCE(v_selection->>'kind', 'none'),
      'code', v_selection->>'code', 'points', COALESCE((v_selection->>'points')::integer, 0)
    );
  END IF;

  -- Re-preparing a pending checkout replaces, rather than duplicates, its old
  -- reservation. This is safe because no provider order has been stamped yet.
  PERFORM public.release_checkout_holds(p_booking_id, v_group_id);
  UPDATE public.bookings
     SET total_price = COALESCE(base_price, subtotal, total_price),
         promo_code_id = NULL, promo_code = NULL, promo_discount = 0,
         points_redeemed = 0, points_discount = 0, discount_snapshot = NULL,
         subtotal = COALESCE(base_price, subtotal, total_price), updated_at = now()
   WHERE ((v_group_id IS NULL AND id = p_booking_id)
       OR (v_group_id IS NOT NULL AND order_group_id = v_group_id))
     AND user_id = p_user_id AND status = 'pending';

  IF p_promo_code IS NOT NULL AND length(trim(p_promo_code)) > 0 THEN
    SELECT * INTO v_promo FROM public.promotion_codes
     WHERE code = upper(trim(p_promo_code)) FOR UPDATE;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'reason', 'invalid');
    END IF;
    IF NOT v_promo.is_active THEN
      RETURN jsonb_build_object('success', false, 'reason', 'inactive');
    END IF;
    IF v_promo.valid_from > now() THEN
      RETURN jsonb_build_object('success', false, 'reason', 'not_started');
    END IF;
    IF v_promo.valid_until IS NOT NULL AND v_promo.valid_until <= now() THEN
      RETURN jsonb_build_object('success', false, 'reason', 'expired');
    END IF;
    SELECT count(*)::integer INTO v_used FROM public.promo_code_usages
     WHERE promo_code_id = v_promo.id AND status IN ('held', 'redeemed');
    v_used := greatest(v_used, COALESCE(v_promo.used_count, 0));
    IF v_promo.max_uses IS NOT NULL AND v_used >= v_promo.max_uses THEN
      RETURN jsonb_build_object('success', false, 'reason', 'usage_limit_reached');
    END IF;
    SELECT count(*)::integer INTO v_user_used FROM public.promo_code_usages
     WHERE promo_code_id = v_promo.id AND user_id = p_user_id AND status IN ('held', 'redeemed');
    IF v_promo.per_user_limit IS NOT NULL AND v_user_used >= v_promo.per_user_limit THEN
      RETURN jsonb_build_object('success', false, 'reason', 'user_limit_reached');
    END IF;
    IF v_promo.min_cart_amount IS NOT NULL AND v_subtotal < v_promo.min_cart_amount THEN
      RETURN jsonb_build_object('success', false, 'reason', 'min_order_not_met', 'min_cart_amount', v_promo.min_cart_amount);
    END IF;
    IF v_promo.discount_type = 'percentage' THEN
      v_promo_discount := round(v_subtotal * v_promo.discount_value / 100, 0);
      IF v_promo.max_discount IS NOT NULL THEN
        v_promo_discount := least(v_promo_discount, v_promo.max_discount);
      END IF;
    ELSE
      v_promo_discount := v_promo.discount_value;
    END IF;
    v_discount := greatest(0, least(round(v_promo_discount, 0)::integer, v_subtotal));
    v_promo_id := v_promo.id;

    INSERT INTO public.promo_code_usages
      (promo_code_id, booking_id, order_group_id, user_id, checkout_key, discount_amount)
    VALUES (v_promo.id, p_booking_id, v_group_id, p_user_id, v_key, v_discount);
  ELSIF p_points > 0 THEN
    SELECT points INTO v_user_points FROM public.users WHERE id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'reason', 'user_not_found');
    END IF;
    SELECT COALESCE(sum(points), 0)::integer INTO v_held_points
      FROM public.points_holds
     WHERE user_id = p_user_id AND status = 'held';
    SELECT rule INTO v_rule
      FROM jsonb_array_elements(COALESCE((SELECT value FROM public.config WHERE key = 'points_redemption'), '[]'::jsonb)) AS rule
     WHERE (rule->>'points')::integer = p_points
     LIMIT 1;
    IF v_rule IS NULL THEN
      RETURN jsonb_build_object('success', false, 'reason', 'invalid_points');
    END IF;
    v_points_discount := least(
      greatest(0, (v_rule->>'discount')::numeric)::integer,
      v_subtotal
    );
    IF p_points > v_user_points - v_held_points THEN
      RETURN jsonb_build_object('success', false, 'reason', 'insufficient_points', 'available_points', greatest(0, v_user_points - v_held_points));
    END IF;
    v_discount := v_points_discount;
    INSERT INTO public.points_holds
      (booking_id, order_group_id, user_id, checkout_key, points, discount_amount)
    VALUES (p_booking_id, v_group_id, p_user_id, v_key, p_points, v_points_discount);
  END IF;

  v_remaining_discount := v_discount;
  v_remaining_subtotal := v_subtotal;
  FOR v_row IN
    SELECT * FROM public.bookings
     WHERE ((v_group_id IS NULL AND id = p_booking_id)
        OR (v_group_id IS NOT NULL AND order_group_id = v_group_id))
       AND user_id = p_user_id
     ORDER BY date, start_time, id
  LOOP
    IF v_remaining_subtotal <= 0 THEN
      v_alloc := 0;
    ELSIF v_remaining_discount <= 0 THEN
      v_alloc := 0;
    ELSE
      v_alloc := CASE
        WHEN v_remaining_subtotal = COALESCE(v_row.base_price, v_row.subtotal, v_row.total_price, 0)
          THEN v_remaining_discount
        ELSE least(v_remaining_discount, round(
          v_discount * COALESCE(v_row.base_price, v_row.subtotal, v_row.total_price, 0)::numeric
          / NULLIF(v_subtotal, 0), 0)::integer)
      END;
    END IF;
    v_alloc := greatest(0, least(v_alloc, COALESCE(v_row.base_price, v_row.subtotal, v_row.total_price, 0)));
    UPDATE public.bookings
       SET subtotal = COALESCE(base_price, subtotal, total_price),
           total_price = greatest(0, COALESCE(base_price, subtotal, total_price) - v_alloc),
           promo_code_id = CASE WHEN v_promo_id IS NULL THEN NULL ELSE v_promo_id END,
           promo_code = CASE WHEN v_promo_id IS NULL THEN NULL ELSE upper(trim(p_promo_code)) END,
           promo_discount = CASE WHEN v_promo_id IS NULL THEN 0 ELSE v_alloc END,
           points_redeemed = CASE WHEN p_points > 0 THEN p_points ELSE 0 END,
           points_discount = CASE WHEN p_points > 0 THEN v_alloc ELSE 0 END,
           discount_snapshot = CASE
             WHEN v_promo_id IS NOT NULL THEN jsonb_build_object('kind','promo','code',upper(trim(p_promo_code)),'promo_code_id',v_promo_id,'discount',v_discount)
             WHEN p_points > 0 THEN jsonb_build_object('kind','points','points',p_points,'discount',v_discount)
             ELSE jsonb_build_object('kind','none','discount',0)
           END,
           updated_at = now()
     WHERE id = v_row.id;
    v_remaining_discount := v_remaining_discount - v_alloc;
    v_remaining_subtotal := v_remaining_subtotal - COALESCE(v_row.base_price, v_row.subtotal, v_row.total_price, 0);
  END LOOP;

  IF v_promo_id IS NOT NULL THEN
    UPDATE public.promo_code_usages SET discount_amount = v_discount WHERE checkout_key = v_key;
  END IF;

  RETURN jsonb_build_object(
    'success', true, 'subtotal', v_subtotal, 'discount_amount', v_discount,
    'total', greatest(0, v_subtotal - v_discount),
    'kind', CASE WHEN v_promo_id IS NOT NULL THEN 'promo' WHEN p_points > 0 THEN 'points' ELSE 'none' END,
    'code', CASE WHEN v_promo_id IS NULL THEN NULL ELSE upper(trim(p_promo_code)) END,
    'points', p_points
  );
END;
$$;

REVOKE ALL ON FUNCTION public.release_checkout_holds(uuid, uuid) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.prepare_checkout(uuid, uuid, text, integer) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_checkout_holds(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.prepare_checkout(uuid, uuid, text, integer) TO service_role;

-- Consume a reservation only after the booking transition has succeeded. This
-- helper is called inside confirm_booking / confirm_booking_group's transaction.
CREATE OR REPLACE FUNCTION public.consume_checkout_discount(
  p_booking_id uuid,
  p_order_group_id uuid,
  p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key text;
  v_hold public.points_holds%ROWTYPE;
  v_usage public.promo_code_usages%ROWTYPE;
BEGIN
  v_key := CASE WHEN p_order_group_id IS NULL
    THEN 'booking:' || p_booking_id::text ELSE 'group:' || p_order_group_id::text END;

  SELECT * INTO v_hold FROM public.points_holds
   WHERE checkout_key = v_key AND status = 'held' FOR UPDATE;
  IF FOUND THEN
    UPDATE public.users
       SET points = points - v_hold.points
     WHERE id = p_user_id AND points >= v_hold.points;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'points balance changed before confirmation';
    END IF;
    INSERT INTO public.points_ledger (user_id, points, type, reference_id, note)
    VALUES (p_user_id, -v_hold.points, 'manual', p_booking_id,
            'Points redeemed for booking ' || p_booking_id::text);
    UPDATE public.points_holds
       SET status = 'redeemed', redeemed_at = now()
     WHERE id = v_hold.id;
  END IF;

  SELECT * INTO v_usage FROM public.promo_code_usages
   WHERE checkout_key = v_key AND status = 'held' FOR UPDATE;
  IF FOUND THEN
    UPDATE public.promotion_codes
       SET used_count = used_count + 1
     WHERE id = v_usage.promo_code_id;
    UPDATE public.promo_code_usages
       SET status = 'redeemed', redeemed_at = now()
     WHERE id = v_usage.id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_checkout_discount(uuid, uuid, uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_checkout_discount(uuid, uuid, uuid) TO service_role;

-- ════════════════════════════════════════════════════════════════════════════
-- 4. Confirmation and lifecycle RPCs. These replace the prior bodies while
-- retaining the signatures used by the existing webhook routes.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.confirm_booking(
  p_booking_id uuid,
  p_payment_intent_id text,
  p_payment_method text,
  p_qr_code text,
  p_event_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking public.bookings%rowtype;
  v_mult numeric;
  v_pts integer;
  v_ref text;
  v_price integer;
BEGIN
  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'reason', 'booking_not_found'); END IF;
  IF v_booking.status = 'confirmed' THEN
    UPDATE public.bookings SET qr_code = COALESCE(qr_code, p_qr_code), updated_at = now()
     WHERE id = p_booking_id AND qr_code IS NULL;
    IF p_event_id IS NOT NULL THEN
      UPDATE public.webhook_events SET status = 'processed', processed_at = now() WHERE id = p_event_id;
    END IF;
    RETURN jsonb_build_object('success', true, 'idempotent', true, 'booking_id', v_booking.id,
      'booking_reference', v_booking.booking_reference, 'table_number', v_booking.table_number,
      'date', v_booking.date, 'start_time', v_booking.start_time, 'end_time', v_booking.end_time,
      'user_id', v_booking.user_id);
  END IF;
  IF v_booking.status NOT IN ('pending', 'payment_failed') THEN
    RETURN jsonb_build_object('success', false, 'reason', 'booking_not_confirmable');
  END IF;

  v_price := COALESCE(v_booking.total_price, 0);
  v_ref := COALESCE(v_booking.booking_reference,
    '248-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)));
  UPDATE public.bookings SET status = 'confirmed', stripe_payment_intent = p_payment_intent_id,
    payment_method = p_payment_method, qr_code = p_qr_code, booking_reference = v_ref, updated_at = now()
   WHERE id = p_booking_id;
  UPDATE public.slots SET status = 'booked', locked_by = NULL, locked_until = NULL WHERE id = v_booking.slot_id;

  PERFORM public.consume_checkout_discount(v_booking.id, NULL, v_booking.user_id);

  IF NOT COALESCE(v_booking.is_free_booking, false) AND v_booking.user_id IS NOT NULL THEN
    SELECT CASE u.tier WHEN 'maximum' THEN 2 WHEN 'century' THEN 1.5 ELSE 1 END
      INTO v_mult FROM public.users u WHERE u.id = v_booking.user_id;
    v_pts := round(v_price * COALESCE(v_mult, 1));
    IF v_pts > 0 THEN
      INSERT INTO public.points_ledger (user_id, points, type, reference_id, note)
      VALUES (v_booking.user_id, v_pts, 'booking', v_booking.id, 'Booking ' || v_ref);
      UPDATE public.users SET points = points + v_pts WHERE id = v_booking.user_id;
    END IF;
  END IF;
  IF p_event_id IS NOT NULL THEN
    UPDATE public.webhook_events SET status = 'processed', processed_at = now() WHERE id = p_event_id;
  END IF;
  RETURN jsonb_build_object('success', true, 'booking_id', v_booking.id, 'booking_reference', v_ref,
    'table_number', v_booking.table_number, 'date', v_booking.date, 'start_time', v_booking.start_time,
    'end_time', v_booking.end_time, 'user_id', v_booking.user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_booking_group(
  p_order_group_id uuid,
  p_payment_intent_id text,
  p_payment_method text,
  p_qr_codes jsonb,
  p_event_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_b public.bookings%rowtype;
  v_user_id uuid;
  v_total integer := 0;
  v_all_confirmed boolean := true;
  v_mult numeric;
  v_pts integer;
  v_ref text;
  v_primary uuid;
  v_ids uuid[] := '{}';
  v_refs text[] := '{}';
  v_qr text;
BEGIN
  FOR v_b IN SELECT * FROM public.bookings WHERE order_group_id = p_order_group_id ORDER BY date, start_time, id FOR UPDATE LOOP
    v_user_id := v_b.user_id;
    IF v_primary IS NULL THEN v_primary := v_b.id; END IF;
    IF v_b.status <> 'confirmed' THEN v_all_confirmed := false; END IF;
  END LOOP;
  IF v_primary IS NULL THEN RETURN jsonb_build_object('success', false, 'reason', 'group_not_found'); END IF;
  IF v_all_confirmed THEN
    IF p_event_id IS NOT NULL THEN UPDATE public.webhook_events SET status = 'processed', processed_at = now() WHERE id = p_event_id; END IF;
    SELECT array_agg(id), array_agg(booking_reference) INTO v_ids, v_refs
      FROM public.bookings WHERE order_group_id = p_order_group_id;
    RETURN jsonb_build_object('success', true, 'idempotent', true, 'order_group_id', p_order_group_id,
      'booking_ids', to_jsonb(v_ids), 'booking_references', to_jsonb(v_refs), 'user_id', v_user_id);
  END IF;

  FOR v_b IN SELECT * FROM public.bookings WHERE order_group_id = p_order_group_id ORDER BY date, start_time, id LOOP
    v_qr := p_qr_codes->>(v_b.id::text);
    v_ref := COALESCE(v_b.booking_reference,
      '248-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)));
    UPDATE public.bookings SET status = 'confirmed', stripe_payment_intent = p_payment_intent_id,
      payment_method = p_payment_method, qr_code = COALESCE(v_qr, qr_code), booking_reference = v_ref, updated_at = now()
     WHERE id = v_b.id;
    UPDATE public.slots SET status = 'booked', locked_by = NULL, locked_until = NULL WHERE id = v_b.slot_id;
    v_total := v_total + COALESCE(v_b.total_price, 0);
    v_ids := array_append(v_ids, v_b.id);
    v_refs := array_append(v_refs, v_ref);
  END LOOP;

  PERFORM public.consume_checkout_discount(v_primary, p_order_group_id, v_user_id);
  IF v_user_id IS NOT NULL AND v_total > 0 THEN
    SELECT CASE u.tier WHEN 'maximum' THEN 2 WHEN 'century' THEN 1.5 ELSE 1 END INTO v_mult
      FROM public.users u WHERE u.id = v_user_id;
    v_pts := round(v_total * COALESCE(v_mult, 1));
    IF v_pts > 0 THEN
      INSERT INTO public.points_ledger (user_id, points, type, reference_id, note)
      VALUES (v_user_id, v_pts, 'booking', v_primary, 'Booking group ' || p_order_group_id::text);
      UPDATE public.users SET points = points + v_pts WHERE id = v_user_id;
    END IF;
  END IF;
  IF p_event_id IS NOT NULL THEN UPDATE public.webhook_events SET status = 'processed', processed_at = now() WHERE id = p_event_id; END IF;
  RETURN jsonb_build_object('success', true, 'order_group_id', p_order_group_id,
    'booking_ids', to_jsonb(v_ids), 'booking_references', to_jsonb(v_refs), 'user_id', v_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_kpay_payment_failed(
  p_booking_id uuid, p_event_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_booking public.bookings%rowtype; v_count integer;
BEGIN
  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'reason', 'booking_not_found'); END IF;
  IF v_booking.order_group_id IS NULL THEN
    UPDATE public.bookings SET status = 'payment_failed', updated_at = now() WHERE id = p_booking_id AND status = 'pending';
  ELSE
    UPDATE public.bookings SET status = 'payment_failed', updated_at = now() WHERE order_group_id = v_booking.order_group_id AND status = 'pending';
  END IF;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  PERFORM public.release_checkout_holds(p_booking_id, v_booking.order_group_id);
  IF p_event_id IS NOT NULL THEN UPDATE public.webhook_events SET status = 'processed', processed_at = now() WHERE id = p_event_id; END IF;
  RETURN jsonb_build_object('success', true, 'booking_id', p_booking_id, 'updated_count', v_count);
END;
$$;

CREATE OR REPLACE FUNCTION public.release_slot_lock(p_slot_id uuid, p_event_id text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_b public.bookings%rowtype;
BEGIN
  SELECT * INTO v_b FROM public.bookings WHERE slot_id = p_slot_id AND status IN ('pending','payment_failed') ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  UPDATE public.slots SET status = 'available', locked_by = NULL, locked_until = NULL WHERE id = p_slot_id AND status = 'locked';
  IF FOUND AND v_b.id IS NOT NULL THEN PERFORM public.release_checkout_holds(v_b.id, v_b.order_group_id); END IF;
  IF p_event_id IS NOT NULL THEN UPDATE public.webhook_events SET status = 'processed', processed_at = now() WHERE id = p_event_id; END IF;
  RETURN jsonb_build_object('success', true, 'slot_id', p_slot_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.release_group_locks(p_order_group_id uuid, p_event_id text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_primary uuid;
BEGIN
  SELECT id INTO v_primary FROM public.bookings WHERE order_group_id = p_order_group_id ORDER BY date, start_time, id LIMIT 1 FOR UPDATE;
  UPDATE public.slots s SET status = 'available', locked_by = NULL, locked_until = NULL
    FROM public.bookings b WHERE b.order_group_id = p_order_group_id AND s.id = b.slot_id AND s.status = 'locked';
  IF v_primary IS NOT NULL THEN PERFORM public.release_checkout_holds(v_primary, p_order_group_id); END IF;
  IF p_event_id IS NOT NULL THEN UPDATE public.webhook_events SET status = 'processed', processed_at = now() WHERE id = p_event_id; END IF;
  RETURN jsonb_build_object('success', true, 'order_group_id', p_order_group_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.retry_payment_failed_booking(p_booking_id uuid, p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_b public.bookings%rowtype; v_group uuid;
BEGIN
  SELECT * INTO v_b FROM public.bookings WHERE id = p_booking_id AND user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'reason', 'booking_not_found'); END IF;
  IF v_b.status NOT IN ('pending','payment_failed') THEN RETURN jsonb_build_object('success', false, 'reason', 'booking_not_retryable'); END IF;
  v_group := v_b.order_group_id;
  PERFORM public.release_checkout_holds(p_booking_id, v_group);
  UPDATE public.bookings SET status = 'pending', payment_provider = NULL, provider_order_no = NULL,
    total_price = COALESCE(base_price, subtotal, total_price), promo_code_id = NULL, promo_code = NULL,
    promo_discount = 0, points_redeemed = 0, points_discount = 0, discount_snapshot = NULL, updated_at = now()
   WHERE ((v_group IS NULL AND id = p_booking_id) OR (v_group IS NOT NULL AND order_group_id = v_group))
     AND user_id = p_user_id AND status IN ('pending','payment_failed');
  RETURN jsonb_build_object('success', true, 'booking_id', p_booking_id, 'order_group_id', v_group);
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_pending_booking(p_booking_id uuid, p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_b public.bookings%rowtype; v_group uuid; v_cancelled integer; v_released integer;
BEGIN
  SELECT * INTO v_b FROM public.bookings WHERE id = p_booking_id AND user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'reason', 'booking_not_found'); END IF;
  IF v_b.status NOT IN ('pending','payment_failed') THEN RETURN jsonb_build_object('success', false, 'reason', 'booking_not_cancellable'); END IF;
  v_group := v_b.order_group_id;
  UPDATE public.bookings SET status = 'cancelled', updated_at = now()
   WHERE ((v_group IS NULL AND id = p_booking_id) OR (v_group IS NOT NULL AND order_group_id = v_group))
     AND user_id = p_user_id AND status IN ('pending','payment_failed');
  GET DIAGNOSTICS v_cancelled = ROW_COUNT;
  PERFORM public.release_checkout_holds(p_booking_id, v_group);
  WITH released AS (
    UPDATE public.slots s SET status = 'available', locked_by = NULL, locked_until = NULL
      FROM public.bookings b WHERE b.user_id = p_user_id
       AND ((v_group IS NULL AND b.id = p_booking_id) OR (v_group IS NOT NULL AND b.order_group_id = v_group))
       AND s.id = b.slot_id AND s.status = 'locked' RETURNING s.id
  ) SELECT count(*) INTO v_released FROM released;
  RETURN jsonb_build_object('success', true, 'booking_id', p_booking_id, 'cancelled_count', v_cancelled, 'released_count', v_released);
END;
$$;

CREATE OR REPLACE FUNCTION public.expire_stale_bookings()
RETURNS TABLE(expired_count integer, freed_slots integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_expired integer; v_freed integer;
BEGIN
  WITH expired AS (
    UPDATE public.bookings SET status = 'expired', updated_at = now()
     WHERE status IN ('pending','payment_failed')
       AND (date < current_date OR (date = current_date AND start_time < (LOCALTIME - interval '1 hour')))
     RETURNING id, slot_id, order_group_id
  ) SELECT count(*) INTO v_expired FROM expired;
  UPDATE public.promo_code_usages u SET status = 'released', released_at = now()
   WHERE status = 'held' AND (u.booking_id IN (SELECT id FROM public.bookings WHERE status = 'expired')
      OR u.order_group_id IN (SELECT order_group_id FROM public.bookings WHERE status = 'expired' AND order_group_id IS NOT NULL));
  UPDATE public.points_holds h SET status = 'released', released_at = now()
   WHERE status = 'held' AND (h.booking_id IN (SELECT id FROM public.bookings WHERE status = 'expired')
      OR h.order_group_id IN (SELECT order_group_id FROM public.bookings WHERE status = 'expired' AND order_group_id IS NOT NULL));
  WITH freed AS (
    UPDATE public.slots s SET status = 'available', locked_by = NULL, locked_until = NULL
     WHERE s.status = 'locked' AND s.id IN (SELECT slot_id FROM public.bookings WHERE status = 'expired' AND slot_id IS NOT NULL)
     RETURNING s.id
  ) SELECT count(*) INTO v_freed FROM freed;
  expired_count := v_expired; freed_slots := v_freed; RETURN NEXT;
END;
$$;

-- Refund helpers restore redeemed points exactly once, in addition to reversing
-- points earned for the booking. A released hold cannot be redeemed again.
CREATE OR REPLACE FUNCTION public.refund_booking(p_payment_intent_id text, p_event_id text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_b public.bookings%rowtype; v_earned integer; v_redeemed integer;
BEGIN
  SELECT * INTO v_b FROM public.bookings WHERE stripe_payment_intent = p_payment_intent_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'reason', 'booking_not_found'); END IF;
  IF v_b.status = 'refunded' THEN
    IF p_event_id IS NOT NULL THEN UPDATE public.webhook_events SET status = 'processed', processed_at = now() WHERE id = p_event_id; END IF;
    RETURN jsonb_build_object('success', true, 'idempotent', true, 'booking_id', v_b.id);
  END IF;
  UPDATE public.bookings SET status = 'refunded', updated_at = now() WHERE id = v_b.id;
  SELECT COALESCE(sum(points),0)::integer INTO v_earned FROM public.points_ledger WHERE reference_id = v_b.id AND type = 'booking';
  IF v_earned > 0 AND v_b.user_id IS NOT NULL THEN
    INSERT INTO public.points_ledger (user_id, points, type, reference_id, note) VALUES (v_b.user_id, -v_earned, 'manual', v_b.id, 'Refund reversal');
    UPDATE public.users SET points = greatest(0, points - v_earned) WHERE id = v_b.user_id;
  END IF;
  UPDATE public.points_holds SET status = 'released', released_at = now()
   WHERE checkout_key = 'booking:' || v_b.id::text AND status = 'held';
  SELECT points INTO v_redeemed FROM public.points_holds WHERE checkout_key = 'booking:' || v_b.id::text AND status = 'redeemed' FOR UPDATE;
  IF v_redeemed > 0 AND v_b.user_id IS NOT NULL THEN
    INSERT INTO public.points_ledger (user_id, points, type, reference_id, note) VALUES (v_b.user_id, v_redeemed, 'manual', v_b.id, 'Refund restored redeemed points');
    UPDATE public.users SET points = points + v_redeemed WHERE id = v_b.user_id;
    UPDATE public.points_holds SET status = 'released', released_at = now()
     WHERE checkout_key = 'booking:' || v_b.id::text AND status = 'redeemed';
  END IF;
  UPDATE public.slots SET status = 'available', locked_by = NULL, locked_until = NULL WHERE id = v_b.slot_id;
  IF p_event_id IS NOT NULL THEN UPDATE public.webhook_events SET status = 'processed', processed_at = now() WHERE id = p_event_id; END IF;
  RETURN jsonb_build_object('success', true, 'booking_id', v_b.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.refund_group(p_order_group_id uuid, p_event_id text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_primary uuid; v_user uuid; v_earned integer; v_redeemed integer;
BEGIN
  SELECT id, user_id INTO v_primary, v_user FROM public.bookings WHERE order_group_id = p_order_group_id ORDER BY date, start_time, id LIMIT 1 FOR UPDATE;
  IF v_primary IS NULL THEN RETURN jsonb_build_object('success', false, 'reason', 'group_not_found'); END IF;
  IF EXISTS (SELECT 1 FROM public.bookings WHERE order_group_id = p_order_group_id AND status = 'refunded') THEN
    IF p_event_id IS NOT NULL THEN UPDATE public.webhook_events SET status = 'processed', processed_at = now() WHERE id = p_event_id; END IF;
    RETURN jsonb_build_object('success', true, 'idempotent', true, 'order_group_id', p_order_group_id);
  END IF;
  UPDATE public.bookings SET status = 'refunded', updated_at = now() WHERE order_group_id = p_order_group_id;
  SELECT COALESCE(sum(points),0)::integer INTO v_earned FROM public.points_ledger WHERE reference_id = v_primary AND type = 'booking';
  IF v_earned > 0 AND v_user IS NOT NULL THEN
    INSERT INTO public.points_ledger (user_id, points, type, reference_id, note) VALUES (v_user, -v_earned, 'manual', v_primary, 'Refund reversal (group)');
    UPDATE public.users SET points = greatest(0, points - v_earned) WHERE id = v_user;
  END IF;
  UPDATE public.points_holds SET status = 'released', released_at = now()
   WHERE checkout_key = 'group:' || p_order_group_id::text AND status = 'held';
  SELECT points INTO v_redeemed FROM public.points_holds WHERE checkout_key = 'group:' || p_order_group_id::text AND status = 'redeemed' FOR UPDATE;
  IF v_redeemed > 0 AND v_user IS NOT NULL THEN
    INSERT INTO public.points_ledger (user_id, points, type, reference_id, note) VALUES (v_user, v_redeemed, 'manual', v_primary, 'Refund restored redeemed points (group)');
    UPDATE public.users SET points = points + v_redeemed WHERE id = v_user;
    UPDATE public.points_holds SET status = 'released', released_at = now() WHERE checkout_key = 'group:' || p_order_group_id::text AND status = 'redeemed';
  END IF;
  UPDATE public.slots s SET status = 'available', locked_by = NULL, locked_until = NULL FROM public.bookings b
   WHERE b.order_group_id = p_order_group_id AND s.id = b.slot_id;
  IF p_event_id IS NOT NULL THEN UPDATE public.webhook_events SET status = 'processed', processed_at = now() WHERE id = p_event_id; END IF;
  RETURN jsonb_build_object('success', true, 'order_group_id', p_order_group_id);
END;
$$;

-- All lifecycle RPCs are server-only. Explicit revokes also remove grants that
-- may have been inherited from earlier CREATE FUNCTION statements.
REVOKE ALL ON FUNCTION public.confirm_booking(uuid,text,text,text,text) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.confirm_booking_group(uuid,text,text,jsonb,text) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_kpay_payment_failed(uuid,text) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_slot_lock(uuid,text) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_group_locks(uuid,text) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.retry_payment_failed_booking(uuid,uuid) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.cancel_pending_booking(uuid,uuid) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.expire_stale_bookings() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.refund_booking(text,text) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.refund_group(uuid,text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_booking(uuid,text,text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.confirm_booking_group(uuid,text,text,jsonb,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_kpay_payment_failed(uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_slot_lock(uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_group_locks(uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.retry_payment_failed_booking(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.cancel_pending_booking(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.expire_stale_bookings() TO service_role;
GRANT EXECUTE ON FUNCTION public.refund_booking(text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.refund_group(uuid,text) TO service_role;
