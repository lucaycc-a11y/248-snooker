-- PaymentX vX1.0.0 — KPay 全托管收銀台 (hosted cashier) as a separate payment system.
--
-- Isolated from the live KPay flow: its own tester allow-list, its own order table
-- and its own event log. Nothing here is read by payment_attempts / reconcile.
-- Service role only (RLS on, no policies).

-- The allow-list was created as managed_cashier_testers in the previous migration.
alter table if exists public.managed_cashier_testers rename to paymentx_testers;

alter table public.bookings drop constraint if exists bookings_payment_method_check;
alter table public.bookings add constraint bookings_payment_method_check check (
  payment_method = any (array[
    'card','apple_pay','google_pay','fps','payme','octopus','alipay','alipayhk',
    'wechat','unionpay_qp','alipay_hk','wechat_pay','free','test','cash',
    'bank_transfer','other','paymentx'
  ]::text[])
);

create table if not exists public.paymentx_orders (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  order_group_id uuid,
  user_id uuid not null,
  managed_out_trade_no text not null,
  managed_order_no text,
  amount numeric(10,2) not null,
  status text not null default 'creating'
    check (status in ('creating','pending','paid','closed','expired','failed','needs_review','cancelled')),
  paid_order_no text,
  failure_reason text,
  is_test boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

-- One live hosted-cashier order per booking: reopening the cashier reuses it.
create unique index if not exists paymentx_orders_one_live_per_booking
  on public.paymentx_orders (booking_id) where status in ('creating', 'pending');
create index if not exists paymentx_orders_managed_order_no_idx on public.paymentx_orders (managed_order_no);
create index if not exists paymentx_orders_out_trade_no_idx on public.paymentx_orders (managed_out_trade_no);
create index if not exists paymentx_orders_created_idx on public.paymentx_orders (created_at desc);

alter table public.paymentx_orders enable row level security;

create table if not exists public.paymentx_events (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  booking_id uuid,
  managed_order_no text,
  kind text not null,
  note text,
  payload jsonb
);
create index if not exists paymentx_events_created_idx on public.paymentx_events (created_at desc);
alter table public.paymentx_events enable row level security;

-- Keep a PaymentX booking alive while its cashier order is open (same 25 min window the
-- sweep already gives a direct KPay attempt), instead of expiring it after 15 minutes.
create or replace function public.expire_stale_pending_bookings()
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_ids uuid[]; v_groups uuid[]; v_id uuid;
begin
  with expired as (
    update public.bookings b
       set status = 'payment_failed', cancellation_reason = 'auto_expired_pending', updated_at = now()
     where b.status = 'pending'
       and b.created_at < now() - interval '15 minutes'
       and not exists (
         select 1 from public.payment_attempts a
          where a.booking_id = b.id
            and a.status in ('claimed', 'pending')
            and a.provider_order_no is not null
            and a.created_at > now() - interval '25 minutes')
       and not exists (
         select 1 from public.paymentx_orders x
          where x.booking_id = b.id
            and x.status = 'pending'
            and x.created_at > now() - interval '25 minutes')
     returning b.id, b.order_group_id
  )
  select coalesce(array_agg(id), '{}'), coalesce(array_agg(order_group_id) filter (where order_group_id is not null), '{}')
    into v_ids, v_groups from expired;

  if coalesce(array_length(v_ids, 1), 0) = 0 then return; end if;

  update public.promo_code_usages u set status = 'released', released_at = now()
   where u.status = 'held' and (u.booking_id = any(v_ids) or u.order_group_id = any(v_groups));
  update public.credit_holds c set status = 'released', released_at = now()
   where c.status = 'held' and (c.booking_id = any(v_ids) or c.order_group_id = any(v_groups));

  foreach v_id in array v_ids loop
    perform public.log_payment_event(v_id, 'swept_expired', 'cron', 'pending', 'payment_failed', 'auto_expired_pending');
  end loop;
end $function$;
