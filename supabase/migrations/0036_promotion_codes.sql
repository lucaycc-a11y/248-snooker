-- 248 Snooker — promotion_codes table (Phase 1 of the promotion code system).
-- Run in the Supabase SQL Editor for project wqmciwieiqvnswvspdyz. Idempotent.
--
-- Service-role only — no authenticated/anon policy. Admin UI reads/writes via
-- API routes that use the service-role client.

CREATE TABLE IF NOT EXISTS public.promotion_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  discount_type text NOT NULL CHECK (discount_type IN ('percentage', 'fixed_amount')),
  discount_value numeric NOT NULL,
  max_uses integer,
  used_count integer NOT NULL DEFAULT 0,
  min_cart_amount numeric,
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.admin_users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.promotion_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "promotion_codes_service_role_all" ON public.promotion_codes;
CREATE POLICY "promotion_codes_service_role_all"
  ON public.promotion_codes
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Public read: anyone can validate a code (read-only, no listing)
DROP POLICY IF EXISTS "promotion_codes_public_read" ON public.promotion_codes;
CREATE POLICY "promotion_codes_public_read"
  ON public.promotion_codes
  FOR SELECT
  USING (true);

-- Function to validate and apply a promotion code.
-- Returns the discount info if valid, or an error reason.
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
DECLARE
  v_record public.promotion_codes%ROWTYPE;
  v_discount numeric;
  v_final numeric;
BEGIN
  SELECT * INTO v_record FROM public.promotion_codes
    WHERE code = upper(trim(p_code))
    AND is_active = true
    AND (valid_until IS NULL OR valid_until > now())
    AND (max_uses IS NULL OR used_count < max_uses);

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'invalid_or_expired');
  END IF;

  IF v_record.min_cart_amount IS NOT NULL AND p_cart_amount < v_record.min_cart_amount THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'min_cart_not_met', 'min_cart_amount', v_record.min_cart_amount);
  END IF;

  IF v_record.discount_type = 'percentage' THEN
    v_discount := round(p_cart_amount * v_record.discount_value / 100, 2);
    v_final := greatest(p_cart_amount - v_discount, 0);
  ELSE
    v_discount := least(v_record.discount_value, p_cart_amount);
    v_final := p_cart_amount - v_discount;
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'code', v_record.code,
    'discount_type', v_record.discount_type,
    'discount_value', v_record.discount_value,
    'discount_amount', v_discount,
    'final_amount', v_final
  );
END;
$$;

REVOKE ALL ON FUNCTION public.validate_promotion_code(text, numeric) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.validate_promotion_code(text, numeric) TO public, anon, authenticated, service_role;

-- Function to increment used_count atomically (called when booking is confirmed)
CREATE OR REPLACE FUNCTION public.use_promotion_code(p_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.promotion_codes
  SET used_count = used_count + 1
  WHERE code = upper(trim(p_code))
    AND is_active = true
    AND (max_uses IS NULL OR used_count < max_uses);

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.use_promotion_code(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.use_promotion_code(text) TO service_role;