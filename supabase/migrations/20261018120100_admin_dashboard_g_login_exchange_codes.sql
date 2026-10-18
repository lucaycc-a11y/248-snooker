-- Migration G: login_exchange_codes
-- Missing table behind POST /api/admin/login and POST /api/admin/exchange-session.
-- Without it every admin login fails at the insert and returns 500
-- "伺服器錯誤". Codes are single-use and expire in 5 minutes.

create table if not exists public.login_exchange_codes (
  code text primary key,
  admin_user_id uuid not null references public.admin_users(id) on delete cascade,
  redirect_scheme text,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists login_exchange_codes_expires_at_idx
  on public.login_exchange_codes (expires_at);

alter table public.login_exchange_codes enable row level security;

revoke all on public.login_exchange_codes from public, anon, authenticated;
grant all on public.login_exchange_codes to service_role;
