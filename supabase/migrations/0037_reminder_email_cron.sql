-- Schedule the reminder email cron job (every 5 minutes)
-- Calls the API endpoint that checks for bookings starting ~30 min from now
-- and sends reminder emails. Idempotent — guards on reminder_email_sent_at IS NULL.

-- First unschedule if it exists (for idempotent re-runs)
select cron.unschedule('send-booking-reminders');

-- Schedule every 5 minutes
select cron.schedule(
  'send-booking-reminders',
  '*/5 * * * *',  -- every 5 minutes
  $$select net.http_post(
    url:='https://space8.com.hk/api/booking/send-reminders',
    headers:='{"Content-Type": "application/json"}'::jsonb
  ) as request_id;
  $$
);