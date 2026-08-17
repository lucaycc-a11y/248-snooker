-- 20260817_admin_login_role_and_exchange_codes
--
-- Web + iOS admin login overhaul:
--   1. admin_users.role gains 'pilot' / 'both' values (web login → iOS role split)
--   2. login_exchange_codes table — one-time, 5-minute exchange codes so the
--      iOS app can swap a browser session for a native Supabase session without
--      ever putting a real token in the callback URL (custom-scheme hijack risk).
--
-- Existing roles: 'super_admin' / 'admin' (0013_admin_users.sql). The CHECK
-- constraint must be replaced (not appended) so the new values are allowed.

-- 1. Widen role CHECK to admin / pilot / both (super_admin / admin stay valid).
ALTER TABLE public.admin_users
  DROP CONSTRAINT IF EXISTS admin_users_role_check;

ALTER TABLE public.admin_users
  ADD CONSTRAINT admin_users_role_check
  CHECK (role IN ('super_admin','admin','pilot','both'));

-- 2. One-time exchange codes. `code` is a URL-safe random token (PK); each row
--    is single-use (used_at flips on first redemption, even on a failed
--    exchange) and short-lived (expires_at = now() + 5 minutes).
CREATE TABLE IF NOT EXISTS public.login_exchange_codes (
  code text PRIMARY KEY,
  admin_user_id uuid NOT NULL REFERENCES public.admin_users(id) ON DELETE CASCADE,
  redirect_scheme text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.login_exchange_codes ENABLE ROW LEVEL SECURITY;

-- service_role only — the same posture as admin_users (0013_admin_users.sql):
-- the web API routes write/read these with the service key; the code is never
-- exposed to anon/authenticated policies (an RLS leak here would let anyone
-- mint codes, defeating the whole exchange layer).
DROP POLICY IF EXISTS "login_exchange_codes_service_role_all" ON public.login_exchange_codes;
CREATE POLICY "login_exchange_codes_service_role_all"
  ON public.login_exchange_codes
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Index used by the exchange endpoint's lookup + expiry sweep.
CREATE INDEX IF NOT EXISTS login_exchange_codes_admin_user_id_idx
  ON public.login_exchange_codes (admin_user_id);

CREATE INDEX IF NOT EXISTS login_exchange_codes_expires_at_idx
  ON public.login_exchange_codes (expires_at);