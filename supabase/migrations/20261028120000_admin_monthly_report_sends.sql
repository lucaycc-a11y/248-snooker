-- One row per month the end-of-month report email has been sent. The primary key makes the cron
-- idempotent: the first run to insert the month wins, retries and double-fires skip.
create table if not exists public.admin_monthly_report_sends (
  month text primary key check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  recipient_count int not null default 0,
  status text not null default 'sending' check (status in ('sending','sent','failed')),
  detail text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
alter table public.admin_monthly_report_sends enable row level security;
-- No policies: only the service role (cron route) reads or writes this table.
