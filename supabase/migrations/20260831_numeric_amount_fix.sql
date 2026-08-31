-- Fix: PayMe decimal amount truncation in checkout flow.
-- The prepare_checkout RPC declared price variables as integer, causing
-- Postgres to round numeric(10,2) values (e.g. 4.81 → 5) on assignment.
-- This broke PayMe test protocol which requires .81/.82 decimal endings.
--
-- Changes: integer → numeric for price-related variables in three RPCs.
-- Safe to re-run: every statement uses CREATE OR REPLACE.

-- ════════════════════════════════════════════════════════════════════════════
-- 1. prepare_checkout — the primary truncation point.
--    v_subtotal, v_discount, v_remaining_discount, v_remaining_subtotal,
--    v_alloc changed from integer → numeric.
--    Also removed ::integer cast on the allocation round() call.
-- ════════════════════════════════════════════════════════════════════════════

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
  v_subtotal numeric := 0;           -- was integer
  v_discount numeric := 0;           -- was integer
  v_remaining_discount numeric := 0; -- was integer
  v_remaining_subtotal numeric := 0; -- was integer
  v_alloc numeric;                   -- was integer
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
    -- FIX: removed ::integer cast — v_discount is now numeric
    v_discount := greatest(0, least(round(v_promo_discount, 0), v_subtotal));
    v_promo_id := v_promo.id;

    INSERT INTO public.promo_code_usages
      (promo_code_id, booking_id, order_group_id, user_id, checkout_key, discount_amount)
    VALUES (v_promo.id, p_booking_id, v_group_id, p_user_id, v_key, v_discount::integer);
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
      -- FIX: removed ::integer cast — v_alloc is now numeric
      v_alloc := CASE
        WHEN v_remaining_subtotal = COALESCE(v_row.base_price, v_row.subtotal, v_row.total_price, 0)
          THEN v_remaining_discount
        ELSE least(v_remaining_discount, round(
          v_discount * COALESCE(v_row.base_price, v_row.subtotal, v_row.total_price, 0)::numeric
          / NULLIF(v_subtotal, 0), 0))
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
    UPDATE public.promo_code_usages SET discount_amount = v_discount::integer WHERE checkout_key = v_key;
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

-- ════════════════════════════════════════════════════════════════════════════
-- 2. confirm_booking — v_price changed from integer → numeric.
--    Affects points calculation (secondary, but consistent).
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
  v_price numeric;                  -- was integer
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

-- ════════════════════════════════════════════════════════════════════════════
-- 3. confirm_booking_group — v_total changed from integer → numeric.
--    Affects points calculation (secondary, but consistent).
-- ════════════════════════════════════════════════════════════════════════════

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
  v_total numeric := 0;             -- was integer
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

-- Permissions (same as original — idempotent)
REVOKE ALL ON FUNCTION public.prepare_checkout(uuid, uuid, text, integer) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.confirm_booking(uuid, text, text, text, text) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.confirm_booking_group(uuid, text, text, jsonb, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_checkout(uuid, uuid, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.confirm_booking(uuid, text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.confirm_booking_group(uuid, text, text, jsonb, text) TO service_role;
