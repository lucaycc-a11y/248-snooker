-- 0018_test_payment_method
--
-- Document 'test' as a valid payment_method value for admin test mode.
-- The column is text (no CHECK constraint), so no schema change is needed.
-- Admin test mode bypasses Stripe and confirms bookings directly via
-- the service-role API route, with payment_method = 'test'.

comment on column public.bookings.payment_method is
  'Payment method: card, apple_pay, google_pay, alipay_hk, wechat_pay, free, test';