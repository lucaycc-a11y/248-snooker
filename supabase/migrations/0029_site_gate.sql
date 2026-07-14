-- 248 Snooker — Site Gate (pre-launch "coming soon" access control).
-- Run this in the Supabase SQL Editor for project wqmciwieiqvnswvspdyz.
-- Safe to re-run: every statement is idempotent.
--
-- site_gate_config is a SINGLETON table (one row, id = true) rather than a key
-- in public.config, because config has a public-read RLS policy (USING (true)
-- — see 0001_pages_foundation.sql) and this table holds a password hash/salt
-- that must never be readable by the anon key. Service-role only, like
-- webhook_events / rate_limits (0003_booking_security_foundation.sql).

CREATE TABLE IF NOT EXISTS public.site_gate_config (
  id uuid PRIMARY KEY DEFAULT '00000000-0000-0000-0000-000000000001',
  enabled boolean NOT NULL DEFAULT false,
  password_hash text,
  password_salt text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.site_gate_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "site_gate_config_service_role_all" ON public.site_gate_config;
CREATE POLICY "site_gate_config_service_role_all"
  ON public.site_gate_config
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Seed the singleton row as OFF, so applying this migration never locks out a
-- live site. Admin turns it on explicitly via /admin/site-gate.
INSERT INTO public.site_gate_config (id, enabled)
VALUES ('00000000-0000-0000-0000-000000000001', false)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.site_gate_ip_whitelist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address text NOT NULL UNIQUE,
  label text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.site_gate_ip_whitelist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "site_gate_ip_whitelist_service_role_all" ON public.site_gate_ip_whitelist;
CREATE POLICY "site_gate_ip_whitelist_service_role_all"
  ON public.site_gate_ip_whitelist
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS public.site_gate_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address text,
  method text NOT NULL CHECK (method IN ('whitelist', 'password', 'denied')),
  user_agent text,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS site_gate_access_log_attempted_idx
  ON public.site_gate_access_log (attempted_at DESC);

ALTER TABLE public.site_gate_access_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "site_gate_access_log_service_role_all" ON public.site_gate_access_log;
CREATE POLICY "site_gate_access_log_service_role_all"
  ON public.site_gate_access_log
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS public.waitlist_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  subscribed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.waitlist_emails ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "waitlist_emails_service_role_all" ON public.waitlist_emails;
CREATE POLICY "waitlist_emails_service_role_all"
  ON public.waitlist_emails
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Prune access log rows older than 30 days, reusing the existing pg_cron
-- extension (enabled in migration 0003).
CREATE OR REPLACE FUNCTION public.cleanup_site_gate_access_log()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.site_gate_access_log
   WHERE attempted_at < now() - interval '30 days';
END;
$$;

SELECT cron.unschedule('cleanup-site-gate-access-log')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-site-gate-access-log');

SELECT cron.schedule(
  'cleanup-site-gate-access-log',
  '41 2 * * *',
  $$SELECT public.cleanup_site_gate_access_log();$$
);
