-- validate_promotion_code now checks the member-history audience rules
-- (new_users / min_orders / min_spend) when a signed-in member applies a code,
-- so the checkout says "not eligible" at entry instead of failing at payment.
-- Same conditions as prepare_checkout, which still enforces them (and the
-- weekday / time-window rules, which need the chosen slots) at payment time.
--
-- ALREADY APPLIED to production on 2026-10-21 via execute_sql. Record only:
--   supabase migration repair --status applied 20261021090000
-- Do not `supabase db push` (migration history is out of sync).
-- Reason code returned: 'audience_not_eligible'.
-- This replaces the 3-arg function body recorded in 20261014000000.

CREATE OR REPLACE FUNCTION public.validate_promotion_code(p_code text, p_cart_amount numeric, p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

    -- Audience rules that depend only on the member's history. Same conditions
    -- as prepare_checkout, which still enforces them (plus weekday / time
    -- windows, which need the chosen slots) at payment time.
    IF v_promo.audience IS DISTINCT FROM 'all' THEN
      IF v_promo.audience = 'new_users' THEN
        IF EXISTS (SELECT 1 FROM public.bookings b WHERE b.user_id = p_user_id AND b.status IN ('confirmed','refunded')) THEN
          RETURN jsonb_build_object('valid', false, 'reason', 'audience_not_eligible');
        END IF;
      ELSIF v_promo.audience = 'min_orders' THEN
        IF (SELECT count(*) FROM public.bookings b WHERE b.user_id = p_user_id AND b.status = 'confirmed') < COALESCE(v_promo.audience_threshold, 1) THEN
          RETURN jsonb_build_object('valid', false, 'reason', 'audience_not_eligible');
        END IF;
      ELSIF v_promo.audience = 'min_spend' THEN
        IF (SELECT COALESCE(sum(b.total_price), 0) FROM public.bookings b WHERE b.user_id = p_user_id AND b.status = 'confirmed') < COALESCE(v_promo.audience_threshold, 1) THEN
          RETURN jsonb_build_object('valid', false, 'reason', 'audience_not_eligible');
        END IF;
      ELSE
        RETURN jsonb_build_object('valid', false, 'reason', 'audience_not_eligible');
      END IF;
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
    'stackable_with_credits', v_promo.stackable_with_credits,
    'discount_amount', v_discount,
    'final_amount', v_final
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.validate_promotion_code(text, numeric, uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_promotion_code(text, numeric, uuid) TO service_role;
