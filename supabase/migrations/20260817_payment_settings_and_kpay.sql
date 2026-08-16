-- 20260817_payment_settings_and_kpay
--
-- KPay direct-connect payment integration: new payment_settings table,
-- bookings columns for provider tracking, and updated payment_method
-- constraint to include KPay methods.
--
-- Idempotent — safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. payment_settings table ────────────────────────────────────────────────

create table if not exists public.payment_settings (
  method     text not null primary key,
  provider   text not null,
  enabled    boolean not null default false,
  updated_at timestamptz not null default now()
);

-- Seed: card / apple_pay / google_pay → Stripe (enabled)
insert into public.payment_settings (method, provider, enabled) values
  ('card',       'stripe', true),
  ('apple_pay',  'stripe', true),
  ('google_pay', 'stripe', true)
on conflict (method) do nothing;

-- Seed: fps / payme / octopus → KPay (disabled by default — admin enables)
insert into public.payment_settings (method, provider, enabled) values
  ('fps',     'kpay', false),
  ('payme',   'kpay', false),
  ('octopus', 'kpay', false)
on conflict (method) do nothing;

-- ── 2. RLS on payment_settings ───────────────────────────────────────────────

alter table public.payment_settings enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'payment_settings'
      and policyname = 'payment_settings_service_role_only'
  ) then
    create policy payment_settings_service_role_only on public.payment_settings
      for all
      to service_role
      using (true)
      with check (true);
  end if;
end $$;

-- ── 3. bookings columns ──────────────────────────────────────────────────────

-- payment_provider: which provider handled this booking ('stripe' | 'kpay')
alter table public.bookings
  add column if not exists payment_provider text;

-- provider_order_no: KPay real orderNo, or Stripe payment intent id
alter table public.bookings
  add column if not exists provider_order_no text;

-- Index for querying by provider order number
create index if not exists idx_bookings_provider_order_no
  on public.bookings (provider_order_no);

-- ── 4. Update payment_method check constraint ───────────────────────────────

-- Drop the existing constraint (idempotent — if already dropped, no-op)
alter table public.bookings
  drop constraint if exists bookings_payment_method_check;

-- Re-create with KPay methods fps / payme / octopus added
alter table public.bookings
  add constraint bookings_payment_method_check
  check (payment_method in (
    'card', 'apple_pay', 'google_pay', 'alipay_hk', 'wechat_pay',
    'fps', 'payme', 'octopus',
    'free', 'test'
  ));

-- ═══════════════════════════════════════════════════════════════════════════════
-- NOTE: This migration does NOT create new RPCs (confirm_booking_kpay etc.).
-- The webhook handler will use the existing confirm_booking RPC, passing the
-- provider_order_no in the stripe_payment_intent field (renamed semantically
-- to "provider reference" at the DB level). The payment_provider column
-- distinguishes which provider the reference belongs to.
-- ═══════════════════════════════════════════════════════════════════════════════