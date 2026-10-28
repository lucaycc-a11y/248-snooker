-- 自動巡檢 (health-watch): runs every 5 minutes. It emails the owner / admins about payment
-- problems (paid-but-unconfirmed bookings, payment-pipeline errors, failed payments, error
-- spikes, revenue-check findings). Uses the same Vault secret as the payment-reconcile job.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'health-watch') then
    perform cron.unschedule('health-watch');
  end if;
end $$;

select cron.schedule(
  'health-watch',
  '*/5 * * * *',
  $job$
  select net.http_post(
    url := 'https://space8.com.hk/api/cron/health-watch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'payment_reconcile_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
  $job$
);
