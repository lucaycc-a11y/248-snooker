-- Payment system switch: which system (kpay | stripe | paymentx) the public uses, plus
-- per-account overrides. Service role only (RLS on, no policies). Changing the public system is
-- super_admin-only with a typed confirmation; both are enforced in /api/admin/payment-system.

create table if not exists public.payment_system_config (
  id int primary key default 1 check (id = 1),
  public_system text not null default 'kpay' check (public_system in ('kpay','stripe','paymentx')),
  updated_by text,
  updated_at timestamptz not null default now()
);
insert into public.payment_system_config (id, public_system) values (1, 'kpay') on conflict (id) do nothing;
alter table public.payment_system_config enable row level security;

create table if not exists public.payment_system_overrides (
  user_id uuid primary key references auth.users(id) on delete cascade,
  system text not null check (system in ('kpay','stripe','paymentx')),
  note text,
  added_by text,
  created_at timestamptz not null default now()
);
alter table public.payment_system_overrides enable row level security;

-- Accounts already on the PaymentX test list keep PaymentX.
insert into public.payment_system_overrides (user_id, system, note, added_by, created_at)
select user_id, 'paymentx', note, added_by, created_at from public.paymentx_testers
on conflict (user_id) do nothing;
