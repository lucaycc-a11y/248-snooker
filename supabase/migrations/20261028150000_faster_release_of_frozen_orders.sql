-- Faster release of frozen checkouts (28 Oct 2026).
-- A booking whose KPay order is still open used to stay frozen (slot, wallet credit, promo)
-- for up to 60 minutes, which blocked customers from re-booking with their wallet credit.
-- The /api/cron/payment-reconcile job (every 5 min) asks KPay about every attempt older
-- than 12 minutes and confirms paid ones, so 25 minutes is a safe backstop. A payment that
-- still arrives later is confirmed by the late-payment path (or parked in payment_review).

-- 15 minutes (matches the slot lock). A booking whose KPay order is still live is
-- frozen until the app sees KPay close/fail it; 25 minutes is the backstop (reconcile asks KPay first, from 12 minutes).
create or replace function public.expire_stale_pending_bookings()
returns void language plpgsql security definer set search_path to 'public' as $$
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
end $$;

-- Starting a new lock must not free the slot of a booking whose KPay order is still
-- payable: that is how a second booking got created while the first could still be paid.
create or replace function public.release_my_locks(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_count integer;
begin
  with released as (
    update public.slots s
       set status = 'available', locked_by = null, locked_until = null
     where s.status = 'locked' and s.locked_by = p_user_id
       and not exists (
         select 1
           from public.bookings b
           join public.payment_attempts a on a.booking_id = b.id
          where b.slot_id = s.id
            and b.user_id = p_user_id
            and b.status = 'pending'
            and a.status in ('claimed', 'pending')
            and a.provider_order_no is not null
            and a.created_at > now() - interval '25 minutes')
    returning s.id
  )
  select count(*) into v_count from released;
  return jsonb_build_object('success', true, 'released', v_count);
end $$;
