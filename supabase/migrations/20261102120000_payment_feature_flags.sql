-- Payment feature flags (admin-switchable). v4.2.0: return_token = no-login payment return page.
create table if not exists public.payment_feature_flags (
  key text primary key,
  mode text not null default 'admins' check (mode in ('off', 'admins')),
  updated_by text,
  updated_at timestamptz not null default now()
);
alter table public.payment_feature_flags enable row level security;
-- No policies: only the service role (server routes) reads or writes.
insert into public.payment_feature_flags (key, mode) values ('return_token', 'admins')
on conflict (key) do nothing;
