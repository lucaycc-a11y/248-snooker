-- 20260817_kpay_extended_methods
--
-- Add alipay / alipayhk / wechat / unionpay_qp to payment_settings (enabled)
-- and extend the bookings payment_method check constraint.
-- Idempotent — safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. Seed new KPay methods (enabled — real keys are configured) ───────────

insert into public.payment_settings (method, provider, enabled) values
  ('alipay',      'kpay', true),
  ('alipayhk',    'kpay', true),
  ('wechat',      'kpay', true),
  ('unionpay_qp', 'kpay', true)
on conflict (method) do nothing;

-- Also enable the original three KPay methods (they were seeded disabled)
update public.payment_settings
  set enabled = true, updated_at = now()
  where method in ('fps', 'payme', 'octopus')
    and provider = 'kpay'
    and enabled = false;

-- ── 2. Extend bookings payment_method check constraint ───────────────────────

alter table public.bookings
  drop constraint if exists bookings_payment_method_check;

alter table public.bookings
  add constraint bookings_payment_method_check
  check (payment_method in (
    'card', 'apple_pay', 'google_pay',
    'fps', 'payme', 'octopus',
    'alipay', 'alipayhk', 'wechat', 'unionpay_qp',
    'alipay_hk', 'wechat_pay',
    'free', 'test'
  ));
