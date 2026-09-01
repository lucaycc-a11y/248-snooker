-- Idempotent migration: ensure renewal_orders table exists.
-- The original definition is in 20260818_space_pilot_backend.sql but was
-- apparently never applied to the production database. This standalone
-- migration uses IF NOT EXISTS so it's safe to run even if the table
-- already exists from a partial application.

create table if not exists public.renewal_orders (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id),
  session_id uuid references public.game_sessions(id),
  extend_minutes integer not null default 60,
  amount integer not null,
  payment_method text references public.payment_settings(method),
  provider_order_no text unique,
  status text not null default 'pending'
    check (status in ('pending','paid','failed','expired','cancelled')),
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  expires_at timestamptz not null default (now() + interval '5 minutes')
);

create index if not exists idx_renewal_orders_booking
  on public.renewal_orders(booking_id);

create unique index if not exists idx_one_pending_renewal_per_booking
  on public.renewal_orders(booking_id) where status = 'pending';

alter table public.renewal_orders enable row level security;
