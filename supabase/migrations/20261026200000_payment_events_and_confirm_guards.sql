-- Payment flow hardening (26 Oct 2026 KPay incident).
-- 1. payment_events: admin-only audit timeline for every payment state decision.
-- 2. confirm_booking / confirm_booking_group: status + slot ownership guards.
--    A paid-but-unconfirmable booking goes to payment_review (no money movement).
-- 3. expire_stale_pending_bookings: 15 min, skip bookings with a live provider order.

create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  booking_id uuid,
  order_group_id uuid,
  attempt_id uuid,
  human_code text,
  provider_order_no text,
  event text not null,
  source text not null check (source in ('webhook','status_poll','cron','user','admin','db','system')),
  from_state text,
  to_state text,
  reason text,
  meta jsonb not null default '{}'::jsonb
);
create index if not exists payment_events_booking_idx on public.payment_events (booking_id, created_at);
create index if not exists payment_events_code_idx on public.payment_events (human_code, created_at);
create index if not exists payment_events_order_idx on public.payment_events (provider_order_no);

alter table public.payment_events enable row level security;
revoke all on public.payment_events from anon, authenticated;
grant select on public.payment_events to authenticated;
drop policy if exists payment_events_admin_select on public.payment_events;
create policy payment_events_admin_select on public.payment_events
  for select to authenticated using (public.is_active_admin());

create or replace function public.log_payment_event(
  p_booking_id uuid, p_event text, p_source text,
  p_from_state text default null, p_to_state text default null, p_reason text default null,
  p_provider_order_no text default null, p_attempt_id uuid default null,
  p_order_group_id uuid default null, p_meta jsonb default '{}'::jsonb
) returns void
language plpgsql security definer set search_path to 'public' as $$
declare v_code text; v_order text;
begin
  select human_code, coalesce(p_provider_order_no, provider_order_no), 
    coalesce(p_order_group_id, order_group_id)
    into v_code, v_order, p_order_group_id
    from public.bookings where id = p_booking_id;
  insert into public.payment_events(booking_id, order_group_id, attempt_id, human_code, provider_order_no,
    event, source, from_state, to_state, reason, meta)
  values (p_booking_id, p_order_group_id, p_attempt_id, v_code, v_order,
    p_event, p_source, p_from_state, p_to_state, p_reason, coalesce(p_meta, '{}'::jsonb));
exception when others then
  null; -- logging must never break a payment transition
end $$;
revoke all on function public.log_payment_event(uuid,text,text,text,text,text,text,uuid,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.log_payment_event(uuid,text,text,text,text,text,text,uuid,uuid,jsonb) to service_role;

-- True when another confirmed booking owns the slot, or another user holds a live lock.
create or replace function public.slot_conflicts_for_booking(p_booking_id uuid)
returns boolean language plpgsql stable security definer set search_path to 'public' as $$
declare b public.bookings%rowtype; s public.slots%rowtype;
begin
  select * into b from public.bookings where id = p_booking_id;
  if not found then return true; end if;
  select * into s from public.slots where id = b.slot_id;
  if not found then return true; end if;
  if exists (select 1 from public.bookings o
              where o.slot_id = b.slot_id and o.id <> b.id and o.status = 'confirmed') then
    return true;
  end if;
  if s.locked_by is not null and s.locked_by is distinct from b.user_id
     and s.locked_until is not null and s.locked_until > now() then
    return true;
  end if;
  return false;
end $$;
revoke all on function public.slot_conflicts_for_booking(uuid) from public, anon, authenticated;
grant execute on function public.slot_conflicts_for_booking(uuid) to service_role;

create or replace function public.confirm_booking(p_booking_id uuid, p_payment_intent_id text, p_payment_method text, p_qr_code text, p_event_id text default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  v_booking public.bookings%rowtype;
  v_ref text;
  v_price numeric;
begin
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then return jsonb_build_object('success', false, 'reason', 'booking_not_found'); end if;
  if v_booking.status = 'confirmed' then
    update public.bookings set qr_code = coalesce(qr_code, p_qr_code), updated_at = now()
     where id = p_booking_id and qr_code is null;
    if p_event_id is not null then
      update public.webhook_events set status = 'processed', processed_at = now() where id = p_event_id;
    end if;
    return jsonb_build_object('success', true, 'idempotent', true, 'booking_id', v_booking.id,
      'booking_reference', v_booking.booking_reference, 'table_number', v_booking.table_number,
      'date', v_booking.date, 'start_time', v_booking.start_time, 'end_time', v_booking.end_time,
      'user_id', v_booking.user_id);
  end if;
  if v_booking.status not in ('pending', 'payment_failed') then
    perform public.log_payment_event(v_booking.id, 'confirm_rejected', 'db', v_booking.status, null,
      'booking_not_confirmable', p_payment_intent_id);
    return jsonb_build_object('success', false, 'reason', 'booking_not_confirmable', 'booking_status', v_booking.status);
  end if;

  if public.slot_conflicts_for_booking(v_booking.id) then
    update public.bookings
       set status = 'payment_review',
           admin_note = coalesce(admin_note || E'\n', '') || 'Paid via provider but slot no longer available; needs manual handling (' || now()::text || ')',
           updated_at = now()
     where id = p_booking_id;
    perform public.log_payment_event(v_booking.id, 'paid_slot_conflict', 'db', v_booking.status, 'payment_review',
      'slot_conflict', p_payment_intent_id);
    return jsonb_build_object('success', false, 'reason', 'slot_conflict_payment_review');
  end if;

  v_price := coalesce(v_booking.total_price, 0);
  v_ref := coalesce(v_booking.booking_reference,
    '248-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)));
  update public.bookings set status = 'confirmed', stripe_payment_intent = p_payment_intent_id,
    payment_method = p_payment_method, qr_code = p_qr_code, booking_reference = v_ref, updated_at = now()
   where id = p_booking_id;
  update public.slots set status = 'booked', locked_by = null, locked_until = null where id = v_booking.slot_id;

  perform public.consume_checkout_discount(v_booking.id, null, v_booking.user_id);

  if not coalesce(v_booking.is_free_booking, false) and v_booking.user_id is not null then
    perform public.award_booking_points(v_booking.user_id, v_price, v_booking.id, 'Booking ' || v_ref);
  end if;
  if p_event_id is not null then
    update public.webhook_events set status = 'processed', processed_at = now() where id = p_event_id;
  end if;
  perform public.log_payment_event(v_booking.id, 'confirmed', 'db', v_booking.status, 'confirmed', null, p_payment_intent_id);
  return jsonb_build_object('success', true, 'booking_id', v_booking.id, 'booking_reference', v_ref,
    'table_number', v_booking.table_number, 'date', v_booking.date, 'start_time', v_booking.start_time,
    'end_time', v_booking.end_time, 'user_id', v_booking.user_id);
end $$;

create or replace function public.confirm_booking_group(p_order_group_id uuid, p_payment_intent_id text, p_payment_method text, p_qr_codes jsonb, p_event_id text default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  v_b public.bookings%rowtype;
  v_user_id uuid;
  v_total numeric := 0;
  v_all_confirmed boolean := true;
  v_bad_status text;
  v_conflict boolean := false;
  v_ref text;
  v_primary uuid;
  v_ids uuid[] := '{}';
  v_refs text[] := '{}';
  v_qr text;
begin
  for v_b in select * from public.bookings where order_group_id = p_order_group_id order by date, start_time, id for update loop
    v_user_id := v_b.user_id;
    if v_primary is null then v_primary := v_b.id; end if;
    if v_b.status <> 'confirmed' then
      v_all_confirmed := false;
      if v_b.status not in ('pending', 'payment_failed') then v_bad_status := v_b.status; end if;
    end if;
  end loop;
  if v_primary is null then return jsonb_build_object('success', false, 'reason', 'group_not_found'); end if;
  if v_all_confirmed then
    if p_event_id is not null then update public.webhook_events set status = 'processed', processed_at = now() where id = p_event_id; end if;
    select array_agg(id), array_agg(booking_reference) into v_ids, v_refs
      from public.bookings where order_group_id = p_order_group_id;
    return jsonb_build_object('success', true, 'idempotent', true, 'order_group_id', p_order_group_id,
      'booking_ids', to_jsonb(v_ids), 'booking_references', to_jsonb(v_refs), 'user_id', v_user_id);
  end if;
  if v_bad_status is not null then
    perform public.log_payment_event(v_primary, 'confirm_rejected', 'db', v_bad_status, null,
      'booking_not_confirmable', p_payment_intent_id, null, p_order_group_id);
    return jsonb_build_object('success', false, 'reason', 'booking_not_confirmable', 'booking_status', v_bad_status);
  end if;

  for v_b in select * from public.bookings where order_group_id = p_order_group_id and status <> 'confirmed' loop
    if public.slot_conflicts_for_booking(v_b.id) then v_conflict := true; end if;
  end loop;
  if v_conflict then
    update public.bookings
       set status = 'payment_review',
           admin_note = coalesce(admin_note || E'\n', '') || 'Paid via provider but a slot is no longer available; needs manual handling (' || now()::text || ')',
           updated_at = now()
     where order_group_id = p_order_group_id and status <> 'confirmed';
    perform public.log_payment_event(v_primary, 'paid_slot_conflict', 'db', 'pending', 'payment_review',
      'slot_conflict', p_payment_intent_id, null, p_order_group_id);
    return jsonb_build_object('success', false, 'reason', 'slot_conflict_payment_review');
  end if;

  for v_b in select * from public.bookings where order_group_id = p_order_group_id order by date, start_time, id loop
    v_qr := p_qr_codes->>(v_b.id::text);
    v_ref := coalesce(v_b.booking_reference,
      '248-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)));
    update public.bookings set status = 'confirmed', stripe_payment_intent = p_payment_intent_id,
      payment_method = p_payment_method, qr_code = coalesce(v_qr, qr_code), booking_reference = v_ref, updated_at = now()
     where id = v_b.id;
    update public.slots set status = 'booked', locked_by = null, locked_until = null where id = v_b.slot_id;
    v_total := v_total + coalesce(v_b.total_price, 0);
    v_ids := array_append(v_ids, v_b.id);
    v_refs := array_append(v_refs, v_ref);
  end loop;

  perform public.consume_checkout_discount(v_primary, p_order_group_id, v_user_id);
  if v_user_id is not null and v_total > 0 then
    perform public.award_booking_points(v_user_id, v_total, v_primary, 'Booking group ' || p_order_group_id::text);
  end if;
  if p_event_id is not null then update public.webhook_events set status = 'processed', processed_at = now() where id = p_event_id; end if;
  perform public.log_payment_event(v_primary, 'confirmed', 'db', 'pending', 'confirmed', null, p_payment_intent_id, null, p_order_group_id);
  return jsonb_build_object('success', true, 'order_group_id', p_order_group_id,
    'booking_ids', to_jsonb(v_ids), 'booking_references', to_jsonb(v_refs), 'user_id', v_user_id);
end $$;

-- 15 minutes (matches the slot lock). A booking whose KPay order is still live is
-- frozen until the app sees KPay close/fail it; 60 minutes is only a leak backstop.
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
            and a.created_at > now() - interval '60 minutes')
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
