-- 248 Snooker — Admin App foundation: is_active_admin(), RLS for
-- purchase_events / site_error_log, and Realtime publication for the three
-- tables the Admin App subscribes to (bookings, purchase_events,
-- site_error_log). Run in the Supabase SQL Editor for project
-- wqmciwieiqvnswvspdyz. Idempotent — safe to re-run.
--
-- purchase_events and site_error_log already exist in production (created
-- ahead of this migration) but have RLS disabled and no policies, so they are
-- currently readable/writable by nobody except service_role callers that
-- bypass RLS entirely. This migration turns RLS on and grants read access to
-- authenticated admins via is_active_admin(), matching the admin_users.is_active
-- flag already in use elsewhere (0013_admin_users.sql).

-- 1. is_active_admin() — SECURITY DEFINER so it can read admin_users
--    regardless of the caller's own RLS visibility into that table.
CREATE OR REPLACE FUNCTION public.is_active_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = auth.uid()
      AND is_active = true
      AND invite_status = 'active'
  );
$$;

REVOKE ALL ON FUNCTION public.is_active_admin() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_active_admin() TO authenticated, service_role;

-- 2. purchase_events — admin read/write via is_active_admin(); no anon access.
ALTER TABLE public.purchase_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "purchase_events_admin_select" ON public.purchase_events;
CREATE POLICY "purchase_events_admin_select"
  ON public.purchase_events
  FOR SELECT
  USING (public.is_active_admin());

DROP POLICY IF EXISTS "purchase_events_admin_update" ON public.purchase_events;
CREATE POLICY "purchase_events_admin_update"
  ON public.purchase_events
  FOR UPDATE
  USING (public.is_active_admin())
  WITH CHECK (public.is_active_admin());

-- 3. site_error_log — same pattern; admins can also mark resolved.
ALTER TABLE public.site_error_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "site_error_log_admin_select" ON public.site_error_log;
CREATE POLICY "site_error_log_admin_select"
  ON public.site_error_log
  FOR SELECT
  USING (public.is_active_admin());

DROP POLICY IF EXISTS "site_error_log_admin_update" ON public.site_error_log;
CREATE POLICY "site_error_log_admin_update"
  ON public.site_error_log
  FOR UPDATE
  USING (public.is_active_admin())
  WITH CHECK (public.is_active_admin());

-- 4. Realtime — add the three tables to the supabase_realtime publication so
--    the Admin App can subscribe to INSERT/UPDATE events. ADD TABLE throws if
--    a table is already a member, so guard each with a catalog check.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'bookings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'purchase_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.purchase_events;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'site_error_log'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.site_error_log;
  END IF;
END $$;

-- 5. Verification query — run after the block above to confirm all three
--    tables are now in the realtime publication (expect 3 rows).
-- SELECT schemaname, tablename FROM pg_publication_tables
-- WHERE pubname = 'supabase_realtime' AND tablename IN ('bookings','purchase_events','site_error_log');
