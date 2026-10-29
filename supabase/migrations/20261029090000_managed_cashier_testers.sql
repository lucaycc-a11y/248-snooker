-- 全托管收銀台 (Managed Cashier) vX1.0.0 — admin-only testing.
--
-- Only accounts listed here are offered the hosted cashier at checkout; every
-- other customer keeps the existing direct-connect flow untouched. Removing all
-- rows switches the feature off. Service role only (RLS on, no policies).

create table if not exists public.managed_cashier_testers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  note text,
  added_by text,
  created_at timestamptz not null default now()
);

alter table public.managed_cashier_testers enable row level security;

-- bookings.payment_method is CHECK-constrained; the hosted cashier stamps its own id.
alter table public.bookings drop constraint if exists bookings_payment_method_check;
alter table public.bookings add constraint bookings_payment_method_check check (
  payment_method = any (array[
    'card','apple_pay','google_pay','fps','payme','octopus','alipay','alipayhk',
    'wechat','unionpay_qp','alipay_hk','wechat_pay','free','test','cash',
    'bank_transfer','other','managed_cashier'
  ]::text[])
);
