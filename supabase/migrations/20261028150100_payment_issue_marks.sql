-- Admin 付款監控: manual "fixed / pending" marks on derived issues.
create table if not exists public.payment_issue_marks (
  issue_id   text primary key,
  status     text not null check (status in ('fixed', 'pending')),
  marked_by  text,
  marked_at  timestamptz not null default now()
);

alter table public.payment_issue_marks enable row level security;
-- No policies: only the service role (admin API routes) reads/writes this table.
