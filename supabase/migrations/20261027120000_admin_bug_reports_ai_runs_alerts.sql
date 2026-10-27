-- Admin bug reports, revenue-check runs and automatic health alerts.
-- Additive only: three new tables, no existing table is touched.
-- RLS is enabled with no policies, so only the service role (server routes) can read or write.

create table if not exists public.admin_bug_reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  reporter_email text not null,
  reporter_user_id uuid,
  severity text not null check (severity in ('urgent', 'annoying', 'idea')),
  title text not null check (char_length(title) between 1 and 120),
  description text not null check (char_length(description) between 1 and 4000),
  page_url text,
  user_agent text,
  viewport text,
  context jsonb not null default '{}'::jsonb,
  has_screenshot boolean not null default false,
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved')),
  resolved_at timestamptz,
  email_sent_at timestamptz,
  email_error text
);
create index if not exists admin_bug_reports_created_idx on public.admin_bug_reports (created_at desc);
create index if not exists admin_bug_reports_reporter_idx on public.admin_bug_reports (reporter_email, created_at desc);
alter table public.admin_bug_reports enable row level security;

create table if not exists public.admin_ai_runs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  kind text not null check (kind in ('manual', 'auto')),
  requested_by text,
  range_from date not null,
  range_to date not null,
  steps jsonb not null default '[]'::jsonb,
  findings jsonb not null default '[]'::jsonb,
  totals jsonb not null default '{}'::jsonb,
  finding_count integer not null default 0,
  summary text,
  model text,
  ai_error text
);
create index if not exists admin_ai_runs_created_idx on public.admin_ai_runs (created_at desc);
alter table public.admin_ai_runs enable row level security;

create table if not exists public.admin_alerts (
  alert_key text primary key,
  severity text not null check (severity in ('high', 'medium', 'low')),
  title text not null,
  detail jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_emailed_at timestamptz,
  resolved_at timestamptz
);
create index if not exists admin_alerts_open_idx on public.admin_alerts (last_seen_at desc) where resolved_at is null;
alter table public.admin_alerts enable row level security;
