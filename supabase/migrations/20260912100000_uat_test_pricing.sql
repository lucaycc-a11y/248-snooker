-- Space8 — uat_test_pricing
--
-- WHY THIS TABLE EXISTS
-- UAT (uat.space8.com.hk) shares the PRODUCTION KPay merchant account; there is
-- no KPay sandbox. So a booking created on UAT with is_test = true charges REAL
-- money unless its total is overridden. This table holds that override: test
-- bookings are made cheap (e.g. HK$1), never free and never faked, so the whole
-- payment path stays genuinely exercised end to end.
--
-- SCOPE GUARANTEE
-- This table is read ONLY when is_test = true. It must never participate in the
-- normal pricing path, which remains config.pricing_rates -> loadPeriods() ->
-- calculatePrice() (see lib/booking/server.ts, lib/pricing.ts). config.pricing
-- and config.pricing_rates are deliberately left untouched by this migration.
--
-- DEVIATION FROM THE ORIGINAL SPEC (intentional, documented):
-- The spec had `updated_by uuid REFERENCES admin_users(user_id)`, but
-- admin_users.user_id carries no UNIQUE/PK constraint, so that FK cannot be
-- created (Postgres requires a unique target). Pointing at auth.users(id)
-- instead is semantically identical here -- admin_users.user_id is itself a
-- reference to auth.users(id) -- and is a valid target.

CREATE TABLE IF NOT EXISTS public.uat_test_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mode text NOT NULL DEFAULT 'flat' CHECK (mode IN ('flat', 'per_hour')),
  amount numeric NOT NULL CHECK (amount >= 0),
  is_active boolean NOT NULL DEFAULT true,
  label text,
  updated_by uuid REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Only one row is expected to be active at a time. This is enforced in the
-- application layer (the dev2 "Set UAT Test Price" action flips the old row off
-- and the new row on inside one RPC/transaction) rather than by a DB
-- constraint, because that flip is inherently two statements. The partial index
-- below makes the lookup of the active row cheap and makes an accidental
-- multi-active state easy to spot.
CREATE INDEX IF NOT EXISTS uat_test_pricing_active_idx
  ON public.uat_test_pricing (is_active, updated_at DESC)
  WHERE is_active = true;

-- RLS: required by the project's security-backend skill for every new table.
-- No anon/authenticated policy is granted. The booking path reads this table
-- with the service key (which bypasses RLS), and the dev2 admin UI reads/writes
-- it through server routes that check admin_users.is_active first. Active admins
-- additionally get direct SELECT via is_active_admin() so the admin app can show
-- the current test price without a dedicated route.
ALTER TABLE public.uat_test_pricing ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS uat_test_pricing_service_role_all ON public.uat_test_pricing;
CREATE POLICY uat_test_pricing_service_role_all
  ON public.uat_test_pricing
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS uat_test_pricing_admin_select ON public.uat_test_pricing;
CREATE POLICY uat_test_pricing_admin_select
  ON public.uat_test_pricing
  FOR SELECT
  USING (public.is_active_admin());

COMMENT ON TABLE public.uat_test_pricing IS
  'Override price for is_test = true bookings only. UAT shares the production KPay merchant account, so test bookings charge real money; this keeps that charge small. Never read for normal bookings.';
COMMENT ON COLUMN public.uat_test_pricing.mode IS
  'flat = the whole booking total becomes `amount`. per_hour = `amount` * booked hours.';

-- set_uat_test_price() — deactivate whatever is active and insert the new active
-- row in ONE transaction, so there is never a window with zero or two active
-- rows. A plain function body in Postgres is already atomic, which is precisely
-- why this lives in the database rather than as two client-side statements.
--
-- Returns the newly created row so the caller can write an audit_log entry with
-- the real stored values rather than echoing back its own input.
CREATE OR REPLACE FUNCTION public.set_uat_test_price(
  p_mode text,
  p_amount numeric,
  p_label text DEFAULT NULL,
  p_updated_by uuid DEFAULT NULL
)
RETURNS public.uat_test_pricing
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.uat_test_pricing;
BEGIN
  IF p_mode IS NULL OR p_mode NOT IN ('flat', 'per_hour') THEN
    RAISE EXCEPTION 'invalid mode: %', p_mode;
  END IF;
  IF p_amount IS NULL OR p_amount < 0 THEN
    RAISE EXCEPTION 'invalid amount: %', p_amount;
  END IF;

  UPDATE public.uat_test_pricing
     SET is_active = false,
         updated_at = now()
   WHERE is_active = true;

  INSERT INTO public.uat_test_pricing (mode, amount, is_active, label, updated_by)
  VALUES (p_mode, p_amount, true, p_label, p_updated_by)
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

-- Only service_role may execute it. Every dev2 call already passes through a
-- server route that verifies admin_users.is_active first, so granting this to
-- `authenticated` would widen the surface for no benefit.
REVOKE ALL ON FUNCTION public.set_uat_test_price(text, numeric, text, uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_uat_test_price(text, numeric, text, uuid) TO service_role;
