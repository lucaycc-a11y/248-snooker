-- ════════════════════════════════════════════════════════════════════════════
-- 20261014000000_promo_credit_stacking
--
-- Lets a promo code and Space Wallet credit be used together on one checkout.
-- The promo discount applies first; credit covers what is left. A code with
-- stackable_with_credits = false rejects the combination outright.
--
-- ⚠️  APPLY THIS FILE MANUALLY — DO NOT `supabase db push`.
--
-- This repo's migration history is out of sync with production (see
-- docs and the migration-history-drift note): production `prepare_checkout`
-- already accepts p_credits and already enforces the HK$10 minimum card charge,
-- but neither behaviour exists in any migration file. Writing this as a full
-- CREATE OR REPLACE means it must be diffed against the LIVE function first,
-- or it will silently revert whatever production has that this file does not.
--
-- Before applying, capture the live bodies and compare:
--
--   supabase db query --linked -f /dev/stdin <<'SQL'
--   SELECT p.proname, pg_get_functiondef(p.oid)
--     FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--    WHERE n.nspname = 'public'
--      AND p.proname IN ('prepare_checkout', 'validate_promotion_code');
--   SQL
--
-- Then apply this one file, and record it as applied:
--
--   supabase db query --linked -f supabase/migrations/20261014000000_promo_credit_stacking.sql
--   supabase migration repair --status applied 20261014000000_promo_credit_stacking
--
-- Column prerequisites (verified present in lib/supabase/database.types.ts):
--   bookings.credit_discount
--   promotion_codes.stackable_with_credits, audience, audience_threshold,
--     weekdays, time_windows
--   credit_holds (booking_id, checkout_key, credits, status, ...)
-- ════════════════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────────────────
-- 1. validate_promotion_code — expose stackable_with_credits to the client.
--
-- The client uses this to decide whether to enable the Space Wallet row. An
-- absent field is treated as stackable, so this is additive and safe either
-- way — but the server check in prepare_checkout is what actually enforces it.
-- ────────────────────────────────────────────────────────────────────────────

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
    'final_amount', v_final,
    -- NEW: lets the client show/hide the Space Wallet row before the server
    -- enforces it. COALESCE so a NULL column reads as stackable.
    'stackable_with_credits', COALESCE(v_promo.stackable_with_credits, true)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.validate_promotion_code(text, numeric, uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_promotion_code(text, numeric, uuid) TO service_role;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. prepare_checkout — promo + credit stacking.
--
-- Order of operations (must match lib/checkout/credit-rule.ts on the client):
--   1. promo discount is computed against the full subtotal
--   2. credit covers (subtotal - promo_discount)
--   3. a card charge must be HK$0 or >= HK$10 — if credit would leave HK$1-9
--      owing, HK$10 less credit is applied and the rest stays on the account
--
-- kind is 'promo' | 'credits' | 'both' | 'points' | 'none'.
-- The response splits discount_amount into promo_discount and credit_discount
-- so callers no longer have to guess at the split.
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.prepare_checkout(
  p_booking_id uuid,
  p_user_id uuid,
  p_promo_code text DEFAULT NULL,
  p_points integer DEFAULT 0,
  p_credits numeric DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking public.bookings%rowtype;
  v_row public.bookings%rowtype;
  v_subtotal numeric := 0;
  v_discount numeric := 0;
  v_promo_discount numeric := 0;
  v_credit_discount numeric := 0;
  v_points_discount integer := 0;
  v_promo_id uuid;
  v_group_id uuid;
  v_key text;
  v_count integer := 0;
  v_alloc numeric;
  v_promo_alloc numeric;
  v_credit_alloc numeric;
  v_row_price numeric;
  v_promo public.promotion_codes%rowtype;
  v_used integer;
  v_user_used integer;
  v_selection jsonb;
  v_user_credits numeric;
  v_held_credits numeric;
  v_available_credits numeric;
  v_wanted numeric;
  v_net numeric;
  v_remaining numeric;
  v_kind text;
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

  -- Points redemption is retired. Reject it explicitly rather than falling
  -- through and returning kind 'points' with no discount actually applied.
  IF COALESCE(p_points, 0) > 0 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'credits_redemption_retired');
  END IF;
  IF p_points < 0 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_points');
  END IF;
  IF p_credits < 0 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_credits');
  END IF;
  IF COALESCE(p_points, 0) > 0 AND (p_promo_code IS NOT NULL AND length(trim(p_promo_code)) > 0) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'discounts_mutually_exclusive');
  END IF;

  -- A provider order already stamped means its discount selection is immutable.
  IF v_booking.provider_order_no IS NOT NULL THEN
    v_selection := v_booking.discount_snapshot;
    IF (p_promo_code IS NULL OR length(trim(p_promo_code)) = 0)
       AND COALESCE(p_points, 0) = 0
       AND COALESCE(p_credits, 0) = 0
       AND COALESCE((v_selection->>'kind'), 'none') <> 'none' THEN
      RETURN jsonb_build_object('success', false, 'reason', 'discount_selection_locked');
    END IF;
    IF COALESCE(p_points, 0) > 0 AND COALESCE((v_selection->>'points')::integer, 0) <> p_points THEN
      RETURN jsonb_build_object('success', false, 'reason', 'discount_selection_locked');
    END IF;
    IF p_promo_code IS NOT NULL AND upper(trim(p_promo_code)) <> COALESCE(v_selection->>'code', '') THEN
      RETURN jsonb_build_object('success', false, 'reason', 'discount_selection_locked');
    END IF;
    RETURN jsonb_build_object(
      'success', true, 'subtotal', v_subtotal,
      'discount_amount',
        COALESCE(v_booking.promo_discount, 0)
        + COALESCE(v_booking.credit_discount, 0)
        + COALESCE(v_booking.points_discount, 0),
      'total', v_booking.total_price,
      'kind', COALESCE(v_selection->>'kind', 'none'),
      'code', v_selection->>'code',
      'points', COALESCE((v_selection->>'points')::integer, 0),
      'promo_discount', COALESCE(v_booking.promo_discount, 0),
      'credit_discount', COALESCE(v_booking.credit_discount, 0)
    );
  END IF;

  -- Re-preparing a pending checkout replaces, rather than duplicates, its old
  -- reservation. This is safe because no provider order has been stamped yet.
  PERFORM public.release_checkout_holds(p_booking_id, v_group_id);
  UPDATE public.bookings
     SET total_price = COALESCE(base_price, subtotal, total_price),
         promo_code_id = NULL, promo_code = NULL, promo_discount = 0,
         credit_discount = 0,
         points_redeemed = 0, points_discount = 0, discount_snapshot = NULL,
         subtotal = COALESCE(base_price, subtotal, total_price), updated_at = now()
   WHERE ((v_group_id IS NULL AND id = p_booking_id)
       OR (v_group_id IS NOT NULL AND order_group_id = v_group_id))
     AND user_id = p_user_id AND status = 'pending';

  -- ── Step 1: promo code, against the full subtotal ─────────────────────────
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
    v_promo_discount := greatest(0, least(round(v_promo_discount, 0), v_subtotal));
    v_promo_id := v_promo.id;

    INSERT INTO public.promo_code_usages
      (promo_code_id, booking_id, order_group_id, user_id, checkout_key, discount_amount)
    VALUES (v_promo.id, p_booking_id, v_group_id, p_user_id, v_key, v_promo_discount::integer);
  END IF;

  -- ── Step 2: Space Wallet credit, on what the promo left behind ────────────
  IF COALESCE(p_credits, 0) > 0 THEN
    -- A non-stackable code forbids combining with credit. Check this before
    -- touching the balance so the customer's credit is never held by a
    -- combination the server is about to reject.
    IF v_promo_id IS NOT NULL
       AND COALESCE(v_promo.stackable_with_credits, true) = false THEN
      RETURN jsonb_build_object('success', false, 'reason', 'promo_not_stackable_with_credits');
    END IF;

    SELECT COALESCE(credits, 0) INTO v_user_credits
      FROM public.users WHERE id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'reason', 'user_not_found');
    END IF;
    SELECT COALESCE(sum(credits), 0)::numeric INTO v_held_credits
      FROM public.credit_holds
     WHERE user_id = p_user_id AND status = 'held';
    v_available_credits := greatest(0, v_user_credits - v_held_credits);
    IF p_credits > v_available_credits THEN
      RETURN jsonb_build_object(
        'success', false, 'reason', 'insufficient_credits',
        'available_credits', v_available_credits
      );
    END IF;

    -- Credit covers the post-promo remainder, never the whole cart.
    v_net := greatest(0, v_subtotal - v_promo_discount);
    v_wanted := floor(least(p_credits, v_net));
    v_remaining := v_net - v_wanted;
    -- A card charge must be HK$0 or >= HK$10. If the credit would leave
    -- HK$1-9 owing, apply HK$10 less credit and leave the rest on the account.
    IF v_remaining >= 1 AND v_remaining < 10 THEN
      v_wanted := v_wanted - 10;
    END IF;
    v_credit_discount := greatest(0, v_wanted);

    IF v_credit_discount > 0 THEN
      INSERT INTO public.credit_holds
        (booking_id, order_group_id, user_id, checkout_key, credits, status)
      VALUES
        (p_booking_id, v_group_id, p_user_id, v_key, v_credit_discount, 'held');
    END IF;
  END IF;

  v_discount := v_promo_discount + v_credit_discount;
  v_kind := CASE
    WHEN v_promo_id IS NOT NULL AND v_credit_discount > 0 THEN 'both'
    WHEN v_promo_id IS NOT NULL THEN 'promo'
    WHEN v_credit_discount > 0 THEN 'credits'
    ELSE 'none'
  END;

  -- ── Step 3: allocate across the group's rows ──────────────────────────────
  -- Promo and credit are allocated in separate passes so bookings.promo_discount
  -- and bookings.credit_discount each sum exactly to their total. Each pass
  -- leaves total_price = base_price - that pass's share.
  FOR v_row IN
    SELECT * FROM public.bookings
     WHERE ((v_group_id IS NULL AND id = p_booking_id)
        OR (v_group_id IS NOT NULL AND order_group_id = v_group_id))
       AND user_id = p_user_id
     ORDER BY date, start_time, id
  LOOP
    v_row_price := COALESCE(v_row.base_price, v_row.subtotal, v_row.total_price, 0);
    v_promo_alloc := 0;
    v_credit_alloc := 0;

    IF v_promo_discount > 0 AND v_row_price > 0 THEN
      v_promo_alloc := CASE
        WHEN v_subtotal = v_row_price THEN v_promo_discount
        ELSE least(v_promo_discount, round(v_promo_discount * v_row_price / NULLIF(v_subtotal, 0), 0))
      END;
      v_promo_alloc := greatest(0, least(v_promo_alloc, v_row_price));
    END IF;
    IF v_credit_discount > 0 AND v_row_price - v_promo_alloc > 0 THEN
      v_credit_alloc := CASE
        WHEN v_subtotal = v_row_price THEN v_credit_discount
        ELSE least(v_credit_discount, round(v_credit_discount * (v_row_price - v_promo_alloc) / NULLIF(greatest(0, v_subtotal - v_promo_discount), 0), 0))
      END;
      v_credit_alloc := greatest(0, least(v_credit_alloc, v_row_price - v_promo_alloc));
    END IF;

    UPDATE public.bookings
       SET subtotal = v_row_price,
           total_price = greatest(0, v_row_price - v_promo_alloc - v_credit_alloc),
           promo_code_id = v_promo_id,
           promo_code = CASE WHEN v_promo_id IS NULL THEN NULL ELSE upper(trim(p_promo_code)) END,
           promo_discount = v_promo_alloc,
           credit_discount = v_credit_alloc,
           points_redeemed = 0,
           points_discount = 0,
           discount_snapshot = jsonb_build_object(
             'kind', v_kind,
             'code', CASE WHEN v_promo_id IS NULL THEN NULL ELSE upper(trim(p_promo_code)) END,
             'promo_code_id', v_promo_id,
             'promo_discount', v_promo_discount,
             'credit_discount', v_credit_discount,
             'discount', v_discount
           ),
           updated_at = now()
     WHERE id = v_row.id;
  END LOOP;

  -- Reconcile rounding drift so the booked total always equals the amount we
  -- ask the payment provider to charge. Without this a multi-row group can be
  -- a dollar off and trip the webhook's amount assertion.
  SELECT greatest(0, v_subtotal - COALESCE(sum(total_price), 0))
    INTO v_alloc
    FROM public.bookings
   WHERE ((v_group_id IS NULL AND id = p_booking_id)
       OR (v_group_id IS NOT NULL AND order_group_id = v_group_id))
     AND user_id = p_user_id;
  IF v_alloc <> v_discount THEN
    UPDATE public.bookings
       SET total_price = greatest(0, total_price - (v_discount - v_alloc)),
           updated_at = now()
     WHERE id = (
       SELECT id FROM public.bookings
        WHERE ((v_group_id IS NULL AND id = p_booking_id)
            OR (v_group_id IS NOT NULL AND order_group_id = v_group_id))
          AND user_id = p_user_id
        ORDER BY date, start_time, id
        LIMIT 1
     );
  END IF;

  IF v_promo_id IS NOT NULL THEN
    UPDATE public.promo_code_usages
       SET discount_amount = v_promo_discount::integer
     WHERE checkout_key = v_key;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'subtotal', v_subtotal,
    'discount_amount', v_discount,
    'total', greatest(0, v_subtotal - v_discount),
    'kind', v_kind,
    'code', CASE WHEN v_promo_id IS NULL THEN NULL ELSE upper(trim(p_promo_code)) END,
    'points', 0,
    'promo_discount', v_promo_discount,
    'credit_discount', v_credit_discount
  );
END;
$$;

REVOKE ALL ON FUNCTION public.prepare_checkout(uuid, uuid, text, integer, numeric) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_checkout(uuid, uuid, text, integer, numeric) TO service_role;
