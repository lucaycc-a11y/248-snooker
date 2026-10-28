-- Payment problems are now emailed the moment they happen (lib/admin/paymentAlertNow.ts, called
-- from logSiteError), so the 5-minute health-watch polling job is removed. The route
-- /api/cron/health-watch stays for manual runs or a slower schedule if ever wanted.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'health-watch') then
    perform cron.unschedule('health-watch');
  end if;
end $$;
