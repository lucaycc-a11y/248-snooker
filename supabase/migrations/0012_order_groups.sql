-- 248 Snooker — non-contiguous multi-block bookings (Option A: N bookings, one
-- PaymentIntent, linked by order_group_id). Run in the Supabase SQL Editor for
-- project wqmciwieiqvnswvspdyz. Idempotent.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- WHY:
--   A user may book several disjoint blocks in one checkout (play 18:00-19:00,
--   eat, play 20:00-21:00). We keep the existing one-booking = one-slot model and
--   group the rows with a shared order_group_id + a single Stripe PaymentIntent.
--   Single-block bookings are unchanged (order_group_id stays NULL and the old
--   single-row RPCs from 0004/0008/0010 keep handling them).
--
-- WHAT:
--   1. bookings.order_group_id (nullable) + index.
--   2. find_or_lock_slots(...)  — atomically lock N blocks or lock NONE.
--   3. confirm_booking_group(...) — confirm every booking in a group atomically,
--      award points once on the group total, stamp webhook_events once.
--   4. release_group_locks(...) / refund_group(...) — failure/refund analogues.
--   All four are service_role-only, matching the single-row siblings.
-- ═══════════════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────────
-- 0. Schema: link column + lookup index
-- ────────────────────────────────────────────────────────────────────
alter table public.bookings
  add column if not exists order_group_id uuid;

create index if not exists bookings_order_group_idx
  on public.bookings (order_group_id)
  where order_group_id is not null;

-- ════════════════════════════════════════════════════════════════════
-- 1. find_or_lock_slots — lock N disjoint blocks in ONE transaction.
--    p_slots is a jsonb array of objects:
--      [{ "date":"YYYY-MM-DD", "start_time":"HH:MM:SS",
--         "duration_hours":1, "table_number":1, "price":80 }, ...]
--    Returns {success:true, slot_ids:[...] } or raises to roll back the whole
--    transaction so a partial lock can never persist (all-or-nothing).
--    Price is computed SERVER-SIDE by the caller (lib/pricing) per block.
-- ════════════════════════════════════════════════════════════════════
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
    -- Also blocks overlap against OUR OWN blocks locked earlier in THIS loop,
    -- because we set locked_by = p_user_id and the "distinct from" excludes ours —
    -- so we additionally guard with an exact-window self-overlap check below.
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

-- ════════════════════════════════════════════════════════════════════
-- 2. confirm_booking_group — confirm every booking in a group atomically.
--    p_qr_codes: jsonb object mapping booking_id::text -> qr token string.
--    Points awarded once, on the SUM of the group's booking prices, using the
--    user's tier multiplier (matches confirm_booking semantics). Idempotent:
--    if the group is already confirmed, repairs any missing QR and returns.
-- ════════════════════════════════════════════════════════════════════
create or replace function public.confirm_booking_group(
  p_order_group_id    uuid,
  p_payment_intent_id text,
  p_payment_method    text,
  p_qr_codes          jsonb,
  p_event_id          text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_b        public.bookings%rowtype;
  v_user_id  uuid;
  v_total    integer := 0;
  v_all_conf boolean := true;
  v_mult     numeric;
  v_pts      integer;
  v_refs     text[] := '{}';
  v_ids      uuid[] := '{}';
  v_qr       text;
  v_ref_out  text;
  v_primary  uuid;   -- first booking id in the group; points ledger reference
begin
  -- Lock all group rows up front (stable order) to serialize duplicate deliveries.
  for v_b in
    select * from public.bookings
     where order_group_id = p_order_group_id
     order by date, start_time
     for update
  loop
    v_user_id := v_b.user_id;
    if v_b.status <> 'confirmed' then
      v_all_conf := false;
    end if;
  end loop;

  if v_user_id is null and not exists (
    select 1 from public.bookings where order_group_id = p_order_group_id
  ) then
    return jsonb_build_object('success', false, 'reason', 'group_not_found');
  end if;

  -- Idempotent short-circuit: everything already confirmed. Repair missing QR.
  if v_all_conf then
    for v_b in
      select * from public.bookings where order_group_id = p_order_group_id
    loop
      v_qr := p_qr_codes->>(v_b.id::text);
      if v_qr is not null then
        update public.bookings
           set qr_code = coalesce(qr_code, v_qr), updated_at = now()
         where id = v_b.id and qr_code is null;
      end if;
      v_refs := array_append(v_refs, v_b.booking_reference);
      v_ids  := array_append(v_ids, v_b.id);
    end loop;
    if p_event_id is not null then
      update public.webhook_events set status = 'processed', processed_at = now()
       where id = p_event_id;
    end if;
    return jsonb_build_object(
      'success', true, 'idempotent', true,
      'order_group_id', p_order_group_id,
      'booking_ids', to_jsonb(v_ids), 'booking_references', to_jsonb(v_refs),
      'user_id', v_user_id
    );
  end if;

  -- Confirm each booking + mark its slot booked. Accumulate the group total from
  -- each booking's own server-set price (never from the caller).
  for v_b in
    select * from public.bookings
     where order_group_id = p_order_group_id
     order by date, start_time
  loop
    v_qr := p_qr_codes->>(v_b.id::text);

    update public.bookings set
      status = 'confirmed',
      stripe_payment_intent = p_payment_intent_id,
      payment_method = p_payment_method,
      qr_code = coalesce(v_qr, qr_code),
      booking_reference = coalesce(
        booking_reference,
        '248-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
      ),
      updated_at = now()
    where id = v_b.id
    returning booking_reference into v_ref_out;

    v_refs  := array_append(v_refs, v_ref_out);
    v_ids   := array_append(v_ids, v_b.id);
    v_total := v_total + coalesce(v_b.total_price, 0);
    if v_primary is null then v_primary := v_b.id; end if;

    update public.slots set status = 'booked', locked_by = null, locked_until = null
     where id = v_b.slot_id;
  end loop;

  -- Award points ONCE on the group total (skip guests). Free bookings aren't
  -- part of the self-serve group path, so no is_free branch here.
  if v_user_id is not null and v_total > 0 then
    select case u.tier when 'maximum' then 2 when 'century' then 1.5 else 1 end
      into v_mult
      from public.users u where u.id = v_user_id;
    v_pts := round(v_total * coalesce(v_mult, 1));
    if v_pts > 0 then
      -- reference_id = the PRIMARY booking id (not the group id). Existing
      -- single-booking RPCs only ever store booking ids here, so if
      -- points_ledger.reference_id carries an FK to bookings.id, a group-id value
      -- would violate it and roll back the whole confirmation. refund_group
      -- reverses by the same primary id.
      insert into public.points_ledger (user_id, points, type, reference_id, note)
      values (v_user_id, v_pts, 'booking', v_primary, 'Booking group ' || p_order_group_id::text);
      update public.users set points = points + v_pts where id = v_user_id;
    end if;
  end if;

  if p_event_id is not null then
    update public.webhook_events set status = 'processed', processed_at = now()
     where id = p_event_id;
  end if;

  return jsonb_build_object(
    'success', true,
    'order_group_id', p_order_group_id,
    'booking_ids', to_jsonb(v_ids), 'booking_references', to_jsonb(v_refs),
    'user_id', v_user_id
  );
end;
$$;

-- ════════════════════════════════════════════════════════════════════
-- 3. release_group_locks — free every held slot in a group (payment_failed).
-- ════════════════════════════════════════════════════════════════════
create or replace function public.release_group_locks(
  p_order_group_id uuid,
  p_event_id       text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.slots s
     set status = 'available', locked_by = null, locked_until = null
   from public.bookings b
   where b.order_group_id = p_order_group_id
     and s.id = b.slot_id
     and s.status = 'locked';

  if p_event_id is not null then
    update public.webhook_events set status = 'processed', processed_at = now()
     where id = p_event_id;
  end if;

  return jsonb_build_object('success', true, 'order_group_id', p_order_group_id);
end;
$$;

-- ════════════════════════════════════════════════════════════════════
-- 4. refund_group — reverse a confirmed group. Idempotent on already-refunded.
-- ════════════════════════════════════════════════════════════════════
create or replace function public.refund_group(
  p_order_group_id uuid,
  p_event_id       text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_pts     integer;
  v_already boolean;
  v_primary uuid;   -- primary booking id the group's points were awarded against
begin
  -- Primary = first booking by the same (date, start_time) order confirm used.
  select bool_and(status = 'refunded'), max(user_id::text)::uuid
    into v_already, v_user_id
    from public.bookings where order_group_id = p_order_group_id;

  if v_user_id is null and v_already is null then
    return jsonb_build_object('success', false, 'reason', 'group_not_found');
  end if;

  if v_already then
    if p_event_id is not null then
      update public.webhook_events set status = 'processed', processed_at = now()
       where id = p_event_id;
    end if;
    return jsonb_build_object('success', true, 'idempotent', true, 'order_group_id', p_order_group_id);
  end if;

  select id into v_primary
    from public.bookings
   where order_group_id = p_order_group_id
   order by date, start_time
   limit 1;

  update public.bookings set status = 'refunded', updated_at = now()
   where order_group_id = p_order_group_id and status <> 'refunded';

  -- Reverse the group's points (awarded once against the PRIMARY booking id).
  select coalesce(sum(points), 0) into v_pts
    from public.points_ledger
   where reference_id = v_primary and type = 'booking';
  if v_pts <> 0 and v_user_id is not null then
    insert into public.points_ledger (user_id, points, type, reference_id, note)
    values (v_user_id, -v_pts, 'manual', v_primary, 'Refund reversal (group)');
    update public.users set points = greatest(0, points - v_pts) where id = v_user_id;
  end if;

  -- Free every slot in the group for resale.
  update public.slots s
     set status = 'available', locked_by = null, locked_until = null
   from public.bookings b
   where b.order_group_id = p_order_group_id and s.id = b.slot_id;

  if p_event_id is not null then
    update public.webhook_events set status = 'processed', processed_at = now()
     where id = p_event_id;
  end if;

  return jsonb_build_object('success', true, 'order_group_id', p_order_group_id);
end;
$$;

-- ════════════════════════════════════════════════════════════════════
-- 5. Grants — service_role only (invoked from API routes / webhook).
-- ════════════════════════════════════════════════════════════════════
revoke all on function public.find_or_lock_slots(uuid, jsonb, integer) from public, anon, authenticated;
revoke all on function public.confirm_booking_group(uuid, text, text, jsonb, text) from public, anon, authenticated;
revoke all on function public.release_group_locks(uuid, text) from public, anon, authenticated;
revoke all on function public.refund_group(uuid, text) from public, anon, authenticated;

grant execute on function public.find_or_lock_slots(uuid, jsonb, integer) to service_role;
grant execute on function public.confirm_booking_group(uuid, text, text, jsonb, text) to service_role;
grant execute on function public.release_group_locks(uuid, text) to service_role;
grant execute on function public.refund_group(uuid, text) to service_role;
