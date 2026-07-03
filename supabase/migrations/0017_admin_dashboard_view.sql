-- 248 Snooker — admin dashboard revenue view (Phase 1 of the /admin rebuild).
-- Run in the Supabase SQL Editor for project wqmciwieiqvnswvspdyz. Idempotent.
--
-- Pre-aggregated so the dashboard never sums the full bookings table on every
-- load (spec: "唔好每次現場aggregate全部bookings row"). Access restricted to
-- service_role only, matching every other admin-only surface — Postgres views
-- don't carry their own RLS, so the grant revoke/grant below is the control.

CREATE OR REPLACE VIEW public.admin_revenue_daily AS
SELECT
  date_trunc('day', date::timestamp) AS day,
  sum(total_price) FILTER (WHERE status = 'confirmed') AS revenue,
  count(*) FILTER (WHERE status = 'confirmed') AS bookings
FROM public.bookings
GROUP BY 1
ORDER BY 1 DESC;

REVOKE ALL ON public.admin_revenue_daily FROM public, anon, authenticated;
GRANT SELECT ON public.admin_revenue_daily TO service_role;
