-- 0035_fix_payment_method_check_constraint
--
-- The bookings.payment_method column has a CHECK constraint that was created
-- manually in Supabase (not in any migration file). This migration:
-- 1. Drops the existing constraint
-- 2. Re-creates it with 'test' included
--
-- Run after confirming the current constraint's allowed values.

alter table public.bookings
  drop constraint if exists bookings_payment_method_check;

alter table public.bookings
  add constraint bookings_payment_method_check
  check (payment_method in (
    'card', 'apple_pay', 'google_pay', 'alipay_hk', 'wechat_pay',
    'free', 'test'
  ));