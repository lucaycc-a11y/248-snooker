-- 248 Snooker — audit_log table (Phase 5 of the /admin rebuild: settings write
-- path + audit trail foundation). Run in the Supabase SQL Editor for project
-- wqmciwieiqvnswvspdyz. Idempotent.
--
-- Backs app/api/admin/config/route.ts (the first writer) and is intended as
-- the shared audit table for later admin write paths (bookings refunds, user
-- points adjustments, CMS publish). Service-role only — no client ever reads
-- this directly, matching admin_users (0013_admin_users.sql).

CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid REFERENCES auth.users(id),
  admin_email text NOT NULL,
  action text NOT NULL,
  target_table text NOT NULL,
  target_id text,
  before_value jsonb,
  after_value jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_log_service_role_all" ON public.audit_log;
CREATE POLICY "audit_log_service_role_all"
  ON public.audit_log
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
