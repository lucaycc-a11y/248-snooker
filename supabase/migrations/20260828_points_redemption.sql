-- 248 Snooker — Points redemption rules + checkout discount columns.
-- Run in the Supabase SQL Editor for project wqmciwieiqvnswvspdyz. Idempotent.

-- ── Redemption rule catalogue ─────────────────────────────────────────────────
create table if not exists public.points_redemption_rules (
  id             uuid primary key default gen_random_uuid(),
  points_required integer not null,
  discount_amount numeric not null,
  is_active       boolean not null default true,
  display_order   integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint points_required_positive check (points_required > 0),
  constraint discount_amount_nonneg   check (discount_amount >= 0)
);

alter table public.points_redemption_rules enable row level security;

-- Members can read active rules; only service_role may mutate.
create policy "points_redemption_rules_read"
  on public.points_redemption_rules
  for select
  using (is_active = true);

create index if not exists idx_points_redemption_rules_active_order
  on public.points_redemption_rules (display_order)
  where is_active = true;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists points_redemption_rules_updated_at on public.points_redemption_rules;
create trigger points_redemption_rules_updated_at
  before update on public.points_redemption_rules
  for each row execute function public.set_updated_at();

-- Seed from config-based rules (100 pts → HK$5, 500 pts → HK$30).
insert into public.points_redemption_rules (points_required, discount_amount, display_order)
values (100, 5, 1), (500, 30, 2)
on conflict do nothing;

-- ── Booking discount columns ──────────────────────────────────────────────────
alter table public.bookings
  add column if not exists points_redeemed integer not null default 0,
  add column if not exists points_discount numeric not null default 0;

-- ── Points holds — one active hold per booking at a time ─────────────────────
create table if not exists public.points_holds (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  booking_id      uuid not null references public.bookings(id) on delete cascade,
  points_amount   integer not null,
  rule_id         uuid not null references public.points_redemption_rules(id),
  status          text not null default 'held'
                    check (status in ('held', 'consumed', 'released')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint points_amount_positive check (points_amount > 0)
);

alter table public.points_holds enable row level security;

create policy "points_holds_read_own"
  on public.points_holds
  for select
  using (auth.uid() = user_id);

-- Exactly one active hold per booking.
create unique index if not exists idx_points_holds_one_active_per_booking
  on public.points_holds (booking_id)
  where status = 'held';

create index if not exists idx_points_holds_user_status
  on public.points_holds (user_id, status);

drop trigger if exists points_holds_updated_at on public.points_holds;
create trigger points_holds_updated_at
  before update on public.points_holds
  for each row execute function public.set_updated_at();
