-- 0038_fix_payment_method_check_constraint_v2
--
-- Repeatedly observed in logs: admin-test-confirm booking fails with
-- 'new row for relation "bookings" violates check constraint
-- "bookings_payment_method_check"' because 'test' is not in the allowed list.
--
-- Migration 0035 attempted to fix this but was apparently never applied
-- (the constraint still exists without 'test'). This migration explicitly
-- drops and recreates the constraint with 'test' included.
--
-- Run this in the Supabase SQL Editor for project wqmciwieiqvnswvspdyz.

alter table public.bookings
  drop constraint if exists bookings_payment_method_check;

alter table public.bookings
  add constraint bookings_payment_method_check
  check (payment_method in (
    'card', 'apple_pay', 'google_pay', 'alipay_hk', 'wechat_pay',
    'free', 'test'
  ));