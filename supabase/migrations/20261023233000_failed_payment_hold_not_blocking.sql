-- A failed / abandoned payment request must not keep a slot locked for other members.
--
-- Before: a KPay decline or a 10-minute pending timeout left bookings.status =
-- 'payment_failed' while the slot stayed `locked` (by the original member) for the
-- full 15-minute TTL, so a second account saw the slot greyed-out with a lock icon.
--
-- Now: a lock only blocks others while its owner still has a PENDING payment request
-- (or the slot is booked, or the owner is mid-checkout and has not created a booking
-- yet). When the owner's latest request failed, whoever starts a payment request
-- first wins. retry_payment_failed_booking keeps its own hold guard, so the original
-- member gets a clean 'hold_expired' if someone else took the slot meanwhile.
--
-- Mirrors failedHoldSlotIds() in lib/booking/server.ts. Idempotent.

CREATE OR REPLACE FUNCTION public.slot_hold_is_failed(p_slot_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
           SELECT 1 FROM public.slots s
             JOIN public.bookings b ON b.slot_id = s.id AND b.user_id = s.locked_by
            WHERE s.id = p_slot_id AND s.status = 'locked' AND b.status = 'payment_failed')
     AND NOT EXISTS (
           SELECT 1 FROM public.slots s
             JOIN public.bookings b ON b.slot_id = s.id AND b.user_id = s.locked_by
            WHERE s.id = p_slot_id AND s.status = 'locked' AND b.status = 'pending');
$$;

REVOKE ALL ON FUNCTION public.slot_hold_is_failed(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.slot_hold_is_failed(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.find_or_lock_slot(p_user_id uuid, p_date date, p_start_time time without time zone, p_duration_hours numeric, p_table_number integer, p_price integer, p_lock_minutes integer DEFAULT 15, p_is_test boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_req_start  timestamp;
  v_req_end    timestamp;
  v_end_time   time;
  v_slot_id    uuid;
  v_locked_until timestamptz;
begin
  if auth.uid() is not null and p_user_id is distinct from auth.uid() then
    return jsonb_build_object('success', false, 'reason', 'unauthorized');
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_table_number::text, 0));

  v_req_start := p_date + p_start_time;
  v_req_end   := v_req_start + (p_duration_hours || ' hours')::interval;
  v_end_time  := (p_start_time + (p_duration_hours || ' hours')::interval)::time;

  if exists (
    select 1 from public.slots s
    where s.table_number = p_table_number
      and s.date between (p_date - 1) and (p_date + 1)
      and (s.is_test = false or s.is_test = p_is_test)
      and (
        s.status = 'booked'
        or (s.status = 'locked' and s.locked_until > now() and s.locked_by is distinct from p_user_id
            and not public.slot_hold_is_failed(s.id))
      )
      and (s.date + s.start_time) < v_req_end
      and (s.date + s.start_time + (s.duration_hours || ' hours')::interval) > v_req_start
  ) then
    return jsonb_build_object('success', false, 'reason', 'unavailable');
  end if;

  v_locked_until := now() + (p_lock_minutes || ' minutes')::interval;

  select id into v_slot_id
  from public.slots
  where table_number = p_table_number and date = p_date and start_time = p_start_time
    and is_test = p_is_test
  limit 1;

  if v_slot_id is not null then
    update public.slots set
      status = 'locked', locked_by = p_user_id, locked_until = v_locked_until,
      end_time = v_end_time, duration_hours = p_duration_hours, price = p_price
    where id = v_slot_id;
  else
    insert into public.slots (date, start_time, end_time, duration_hours, price, status, locked_by, locked_until, table_number, is_test)
    values (p_date, p_start_time, v_end_time, p_duration_hours, p_price, 'locked', p_user_id, v_locked_until, p_table_number, p_is_test)
    returning id into v_slot_id;
  end if;

  return jsonb_build_object('success', true, 'slot_id', v_slot_id, 'locked_until', v_locked_until);
end;
$function$;

CREATE OR REPLACE FUNCTION public.find_or_lock_slots(p_user_id uuid, p_slots jsonb, p_lock_minutes integer DEFAULT 15)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_block         jsonb;
  v_date          date;
  v_start_time    time;
  v_duration      numeric;
  v_table         integer;
  v_price         integer;
  v_req_start     timestamp;
  v_req_end       timestamp;
  v_end_time      time;
  v_slot_id       uuid;
  v_locked_until  timestamptz;
  v_slot_ids      uuid[] := '{}';
begin
  if p_slots is null or jsonb_typeof(p_slots) <> 'array' or jsonb_array_length(p_slots) = 0 then
    raise exception 'find_or_lock_slots: p_slots must be a non-empty array';
  end if;

  v_locked_until := now() + (p_lock_minutes || ' minutes')::interval;

  for v_block in select * from jsonb_array_elements(p_slots)
  loop
    v_date     := (v_block->>'date')::date;
    v_start_time := (v_block->>'start_time')::time;
    v_duration := (v_block->>'duration_hours')::numeric;
    v_table    := (v_block->>'table_number')::integer;
    v_price    := (v_block->>'price')::integer;

    perform pg_advisory_xact_lock(hashtextextended(v_table::text, 0));

    v_req_start := v_date + v_start_time;
    v_req_end   := v_req_start + (v_duration || ' hours')::interval;
    v_end_time  := (v_start_time + (v_duration || ' hours')::interval)::time;

    if exists (
      select 1 from public.slots s
      where s.table_number = v_table
        and s.date between (v_date - 1) and (v_date + 1)
        and s.is_test = false
        and (
          s.status = 'booked'
          or (s.status = 'locked' and s.locked_until > now() and s.locked_by is distinct from p_user_id
              and not public.slot_hold_is_failed(s.id))
        )
        and (s.date + s.start_time) < v_req_end
        and (s.date + s.start_time + (s.duration_hours || ' hours')::interval) > v_req_start
    ) then
      raise exception 'slot_unavailable:%:% ', v_table, (v_date || ' ' || v_start_time)
        using errcode = 'P0001';
    end if;

    if exists (
      select 1 from unnest(v_slot_ids) sid
      join public.slots s on s.id = sid
      where s.table_number = v_table
        and (s.date + s.start_time) < v_req_end
        and (s.date + s.start_time + (s.duration_hours || ' hours')::interval) > v_req_start
    ) then
      raise exception 'overlapping_request_blocks:%:%', v_table, (v_date || ' ' || v_start_time)
        using errcode = 'P0001';
    end if;

    select id into v_slot_id
    from public.slots
    where table_number = v_table and date = v_date and start_time = v_start_time
      and is_test = false
    limit 1;

    if v_slot_id is not null then
      update public.slots set
        status = 'locked', locked_by = p_user_id, locked_until = v_locked_until,
        end_time = v_end_time, duration_hours = v_duration, price = v_price
      where id = v_slot_id;
    else
      insert into public.slots (date, start_time, end_time, duration_hours, price, status, locked_by, locked_until, table_number, is_test)
      values (v_date, v_start_time, v_end_time, v_duration, v_price, 'locked', p_user_id, v_locked_until, v_table, false)
      returning id into v_slot_id;
    end if;

    v_slot_ids := array_append(v_slot_ids, v_slot_id);
  end loop;

  return jsonb_build_object('success', true, 'slot_ids', to_jsonb(v_slot_ids), 'locked_until', v_locked_until);
end;
$function$;
