-- Violation cases (違規個案) — a member breaks the venue rules (smoking, damage, overtime, …),
-- admin / Spark opens a case, the member is emailed a pay link, and the fee is collected through
-- KPay 全托管收銀台 (PaymentX hosted cashier).
--
-- Isolated on purpose: penalty money never touches bookings, paymentx_orders or any revenue
-- table, so it cannot leak into booking income or reconcile jobs. Service role only
-- (RLS on, no policies) — every read and write goes through server code.

create table if not exists public.violation_cases (
  id uuid primary key default gen_random_uuid(),
  case_no text not null unique,
  user_id uuid not null,
  booking_id uuid references public.bookings(id) on delete set null,
  scenario text not null
    check (scenario in ('smoking','damage','overtime','over_capacity','pet','other')),
  title text not null,
  detail text,
  evidence_note text,
  amount numeric(10,2) not null check (amount >= 0 and amount <= 20000),
  currency text not null default 'HKD',
  status text not null default 'draft'
    check (status in ('draft','notified','paid','overdue','waived','cancelled')),
  apply_blacklist boolean not null default false,
  pay_token text not null unique,
  incident_at timestamptz,
  due_at timestamptz,
  notified_at timestamptz,
  reminders_sent integer not null default 0,
  last_reminder_at timestamptz,
  paid_at timestamptz,
  waived_reason text,
  created_by uuid,
  created_by_email text,
  is_test boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists violation_cases_user_idx on public.violation_cases (user_id, created_at desc);
create index if not exists violation_cases_status_idx on public.violation_cases (status, due_at);
create index if not exists violation_cases_created_idx on public.violation_cases (created_at desc);

alter table public.violation_cases enable row level security;

-- One row per hosted-cashier attempt. A KPay managed order lives only ~10 minutes, so a case
-- normally collects several attempts over its life; at most one of them is live at a time.
create table if not exists public.violation_case_payments (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.violation_cases(id) on delete cascade,
  managed_out_trade_no text not null unique,
  managed_order_no text,
  amount numeric(10,2) not null,
  status text not null default 'creating'
    check (status in ('creating','pending','paid','closed','expired','failed','needs_review')),
  paid_order_no text,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create unique index if not exists violation_case_payments_one_live
  on public.violation_case_payments (case_id) where status in ('creating', 'pending');
create index if not exists violation_case_payments_order_no_idx
  on public.violation_case_payments (managed_order_no);

alter table public.violation_case_payments enable row level security;
