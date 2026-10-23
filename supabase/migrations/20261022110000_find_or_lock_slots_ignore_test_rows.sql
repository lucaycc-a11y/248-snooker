-- find_or_lock_slots: stop is_test slot rows (leftover admin test bookings,
-- status 'booked'/'locked') from blocking real availability, and stop it from
-- re-using / overwriting a test row. Mirrors find_or_lock_slot(), which already
-- ignores test rows. The UI availability queries already exclude is_test rows,
-- so before this the board showed a slot as free while the RPC said "taken".
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
          or (s.status = 'locked' and s.locked_until > now() and s.locked_by is distinct from p_user_id)
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
