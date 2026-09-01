-- 248 Snooker — hourly expiry of stale bookings (full lifecycle) via pg_cron.
--
-- Runs public.expire_stale_bookings() every hour. That function marks
-- pending/payment_failed bookings past their start time as 'expired', frees
-- their slot locks, and re-releases held promo-code usages / points holds.
--
-- Complements (does NOT replace) the existing booking-sweep crons:
--   - expire-stale-pending-bookings  (every 2 min): pending >10min -> payment_failed
--   - cleanup-failed-bookings-daily  (daily 20:00): deletes 24h-old failed/cancelled/expired
--
-- The route app/api/booking/expire-stale (Vercel edge-cron) was removed in
-- commit 0d910fe because the Vercel Hobby plan does not support cron jobs;
-- pg_cron is the replacement, matching how cleanup_failed_bookings() and the
-- admin member-code rotation are already scheduled.
--
-- Idempotent: unschedule first so re-running this migration is safe.

select cron.unschedule('expire-stale-bookings-hourly')
  where exists (select 1 from cron.job where jobname = 'expire-stale-bookings-hourly');

-- '13 * * * *' — hourly, off the :00 mark to avoid the top-of-hour stampede
-- (same reasoning as the apple-secret-rotation cron in migration 0002).
select cron.schedule(
  'expire-stale-bookings-hourly',
  '13 * * * *',
  $$select public.expire_stale_bookings();$$
);
