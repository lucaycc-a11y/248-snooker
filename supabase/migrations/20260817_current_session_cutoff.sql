-- 248 Snooker — 15-minute current-session cutoff + remove buggy try_lock_slot.
--
-- Task A: Drop the buggy try_lock_slot (5-arg) that writes status = 'cancelled'
--         to the bookings table (a value not in the bookings_status_check
--         constraint). Verified: zero callers in the repo.
--         Keep the safe 3-arg try_lock_slot (slot-level locking, no bookings
--         table writes).
--
-- Task B: If the requested session is currently ongoing (start ≤ now < end) and
--         more than 15 minutes have passed since the session start, reject the
--         lock. This prevents booking a session that has already been running
--         for a while.
--
-- Idempotent — safe to re-run.

-- ═════════════════════════════════════════════════════════════════════════════
-- 1. Drop the buggy try_lock_slot (5-arg, operates on bookings table)
-- ═════════════════════════════════════════════════════════════════════════════

drop function if exists public.try_lock_slot(
  p_user_id uuid, p_date date, p_start_time time, p_duration_hours numeric, p_table_number integer
);

-- ═════════════════════════════════════════════════════════════════════════════
-- 2. Update find_or_lock_slot with 15-minute current-session cutoff
-- ═════════════════════════════════════════════════════════════════════════════

create or replace function public.find_or_lock_slot(
  p_user_id        uuid,
  p_date           date,
  p_start_time     time,
  p_duration_hours numeric,
  p_table_number   integer,
  p_price          integer,
  p_lock_minutes   integer default 15
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req_start  timestamp;
  v_req_end    timestamp;
  v_end_time   time;
  v_slot_id    uuid;
  v_locked_until timestamptz;
begin
  -- Defense-in-depth: if invoked with a user JWT (auth.uid() set), the caller
  -- may only lock a slot for themselves. Service-role calls (auth.uid() IS
  -- NULL) are unaffected — they already resolve p_user_id server-side.
  if auth.uid() is not null and p_user_id is distinct from auth.uid() then
    return jsonb_build_object('success', false, 'reason', 'unauthorized');
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_table_number::text, 0));

  v_req_start := p_date + p_start_time;
  v_req_end   := v_req_start + (p_duration_hours || ' hours')::interval;
  v_end_time  := (p_start_time + (p_duration_hours || ' hours')::interval)::time; -- wraps past midnight

  -- Unavailable if any booked row or foreign active lock overlaps this window.
  if exists (
    select 1 from public.slots s
    where s.table_number = p_table_number
      and s.date between (p_date - 1) and (p_date + 1)
      and (
        s.status = 'booked'
        or (s.status = 'locked' and s.locked_until > now() and s.locked_by is distinct from p_user_id)
      )
      and (s.date + s.start_time) < v_req_end
      and (s.date + s.start_time + (s.duration_hours || ' hours')::interval) > v_req_start
  ) then
    return jsonb_build_object('success', false, 'reason', 'unavailable');
  end if;

  -- 15-minute current-session cutoff: if the session is ongoing and more than
  -- 15 minutes have passed since the start, reject the booking.
  if v_req_start <= now() and now() < v_req_end and now() > v_req_start + interval '15 minutes' then
    return jsonb_build_object('success', false, 'reason', 'current_session_cutoff_passed');
  end if;

  v_locked_until := now() + (p_lock_minutes || ' minutes')::interval;

  select id into v_slot_id
  from public.slots
  where table_number = p_table_number and date = p_date and start_time = p_start_time
  limit 1;

  if v_slot_id is not null then
    update public.slots set
      status = 'locked', locked_by = p_user_id, locked_until = v_locked_until,
      end_time = v_end_time, duration_hours = p_duration_hours, price = p_price
    where id = v_slot_id;
  else
    insert into public.slots (date, start_time, end_time, duration_hours, price, status, locked_by, locked_until, table_number)
    values (p_date, p_start_time, v_end_time, p_duration_hours, p_price, 'locked', p_user_id, v_locked_until, p_table_number)
    returning id into v_slot_id;
  end if;

  return jsonb_build_object('success', true, 'slot_id', v_slot_id, 'locked_until', v_locked_until);
end;
$$;

revoke all on function public.find_or_lock_slot(uuid, date, time, numeric, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.find_or_lock_slot(uuid, date, time, numeric, integer, integer, integer) to service_role;

-- ═════════════════════════════════════════════════════════════════════════════
-- 3. Update find_or_lock_slots with 15-minute current-session cutoff
-- ═════════════════════════════════════════════════════════════════════════════

create or replace function public.find_or_lock_slots(
  p_user_id      uuid,
  p_slots        jsonb,
  p_lock_minutes integer default 15
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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

    -- Serialize concurrent lockers on this TABLE (same rule as find_or_lock_slot).
    perform pg_advisory_xact_lock(hashtextextended(v_table::text, 0));

    v_req_start := v_date + v_start_time;
    v_req_end   := v_req_start + (v_duration || ' hours')::interval;
    v_end_time  := (v_start_time + (v_duration || ' hours')::interval)::time; -- wraps past midnight

    -- Unavailable if any booked row or foreign active lock overlaps this window.
    if exists (
      select 1 from public.slots s
      where s.table_number = v_table
        and s.date between (v_date - 1) and (v_date + 1)
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

    -- 15-minute current-session cutoff: if the session is ongoing and more than
    -- 15 minutes have passed since the start, reject the booking.
    if v_req_start <= now() and now() < v_req_end and now() > v_req_start + interval '15 minutes' then
      raise exception 'current_session_cutoff_passed:%:%', v_table, (v_date || ' ' || v_start_time)
        using errcode = 'P0001';
    end if;

    -- Guard against the caller sending two overlapping blocks in the SAME request
    -- on the same table (our own fresh locks are excluded from the check above).
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

    -- Reuse a row at this exact start, else create one. Lands on locked-for-user.
    select id into v_slot_id
    from public.slots
    where table_number = v_table and date = v_date and start_time = v_start_time
    limit 1;

    if v_slot_id is not null then
      update public.slots set
        status = 'locked', locked_by = p_user_id, locked_until = v_locked_until,
        end_time = v_end_time, duration_hours = v_duration, price = v_price
      where id = v_slot_id;
    else
      insert into public.slots (date, start_time, end_time, duration_hours, price, status, locked_by, locked_until, table_number)
      values (v_date, v_start_time, v_end_time, v_duration, v_price, 'locked', p_user_id, v_locked_until, v_table)
      returning id into v_slot_id;
    end if;

    v_slot_ids := array_append(v_slot_ids, v_slot_id);
  end loop;

  return jsonb_build_object('success', true, 'slot_ids', to_jsonb(v_slot_ids), 'locked_until', v_locked_until);
end;
$$;

revoke all on function public.find_or_lock_slots(uuid, jsonb, integer) from public, anon, authenticated;
grant execute on function public.find_or_lock_slots(uuid, jsonb, integer) to service_role;