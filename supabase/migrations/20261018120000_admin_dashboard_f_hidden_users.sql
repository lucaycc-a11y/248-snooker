-- Migration F: admin_hidden_users
-- A hidden user is excluded from admin lists, totals and the revenue export.
-- Nothing is deleted; the member is still reachable by direct link with a
-- 已隱藏 badge. Service role only — no RLS policies on purpose.

create table if not exists public.admin_hidden_users (
  user_id uuid primary key references public.users(id) on delete cascade,
  reason text,
  created_by uuid,
  created_at timestamptz not null default now()
);

alter table public.admin_hidden_users enable row level security;

revoke all on public.admin_hidden_users from public, anon, authenticated;
grant all on public.admin_hidden_users to service_role;
