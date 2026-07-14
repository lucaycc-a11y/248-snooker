-- 248 Snooker — release_expired_slot_locks pg_cron health check.
-- Paste into Supabase SQL Editor for project wqmciwieiqvnswvspdyz.
--
-- Expected healthy state:
--   * A cron.job row exists with jobname like '%release_expired%'.
--   * It is active and scheduled every minute.
--   * Recent cron.job_run_details rows have status='succeeded'.
--   * return_message shows the function ran cleanly (or no error text).

-- 1) List matching jobs.
select
  jobid,
  schedule,
  command,
  nodename,
  nodeport,
  database,
  username,
  active,
  jobname
from cron.job
where jobname ilike '%release_expired%'
   or command ilike '%release_expired_slot_locks%'
order by jobid;

-- 2) Recent run history for the matching job(s). This is the task's requested query,
-- expanded to handle multiple matching rows safely.
select
  d.jobid,
  j.jobname,
  d.runid,
  d.job_pid,
  d.database,
  d.username,
  d.command,
  d.status,
  d.return_message,
  d.start_time,
  d.end_time
from cron.job_run_details d
join cron.job j on j.jobid = d.jobid
where j.jobname ilike '%release_expired%'
   or j.command ilike '%release_expired_slot_locks%'
order by d.start_time desc
limit 20;

-- 3) Quick stuck-lock check: expired locks that should already be releasable.
select
  id,
  table_number,
  date,
  start_time,
  end_time,
  status,
  locked_by,
  locked_until,
  now() as checked_at,
  now() - locked_until as expired_for
from public.slots
where status = 'locked'
  and locked_until < now()
order by locked_until asc
limit 50;

-- 4) Optional manual repair if the cron job is missing or failing:
--    First inspect output above. If stuck locks exist and cron is unhealthy, run:
--
-- select public.release_expired_slot_locks();
--
--    Then re-run query #3. If it clears, fix pg_cron scheduling by re-running the
--    scheduling block from migration 0004_booking_lock_and_rpcs.sql.
