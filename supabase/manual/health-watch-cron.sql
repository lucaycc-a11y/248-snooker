-- 自動巡檢 scheduler. NOT a migration: run it by hand ONLY AFTER /api/cron/health-watch is
-- deployed to production, otherwise every call returns 404.
-- Reuses the secret the payment-reconcile job already uses (vault: payment_reconcile_cron_secret,
-- env: PAYMENT_RECONCILE_CRON_SECRET), so no new secret is needed.
-- The investigator can take up to ~45s, hence the 58s timeout.
-- Also required in Vercel env: RESEND_API_KEY (already set), MIMO_API_KEY (new, optional —
-- without it the emails and summaries simply use plain code-written text).

select cron.schedule(
  'health-watch',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := 'https://space8.com.hk/api/cron/health-watch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'payment_reconcile_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 58000
  );
  $$
);

-- To stop it:  select cron.unschedule('health-watch');
