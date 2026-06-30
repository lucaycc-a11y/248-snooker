-- 248 Snooker — on-demand slot locking, atomic confirm, refund, lock expiry.
-- Run in the Supabase SQL Editor for project wqmciwieiqvnswvspdyz. Idempotent.
--
-- DESIGN (Option B — generate slot on demand):
--   * `slots` is currently EMPTY. Rows are created/locked on the fly by
--     find_or_lock_slot() when a user picks a date+time+table, NOT pre-populated.
--   * The "lock" lives ON the slots row (status='locked', locked_by, locked_until).
--     There is no separate slot_locks table.
--   * Overlap/availability is computed from real timestamps (date + start_time +
--     duration) so cross-midnight bookings are handled correctly, and the overlap
--     query scans ±1 day so a late booking (e.g. 22:00 + 3h) is checked against
--     next-day rows. Concurrency is serialized with a transaction advisory lock
--     keyed on table_number alone, so two lockers on adjacent dates still serialize.
--
-- ⚠️ BACKUP BEFORE RUNNING: this migration REPLACES confirm_booking's jsonb
-- overload and DROPS its dead void overload. Dump the current definitions first:
--   SELECT pg_get_functiondef(oid) FROM pg_proc
--   WHERE proname IN ('confirm_booking','try_lock_slot') ORDER BY proname;

-- ════════════════════════════════════════════════════════════════════
-- 0. Extensions + guards
-- ════════════════════════════════════════════════════════════════════
create extension if not exists pg_cron;

-- Cheap dup guard: at most one active hold per exact (table, date, start). Broader
-- arbitrary-overlap protection is enforced inside find_or_lock_slot under the
-- advisory lock (durations vary, so an exact-start unique index can't catch all
-- overlaps on its own).
create unique index if not exists slots_active_start_uniq
  on public.slots (table_number, date, start_time)
  where status in ('locked', 'booked');

create index if not exists slots_table_date_idx
  on public.slots (table_number, date);

-- ════════════════════════════════════════════════════════════════════
-- 1. find_or_lock_slot — find-or-create a slots row and lock it for the user.
--    Returns jsonb {success, slot_id, locked_until} or {success:false, reason}.
--    p_price is computed SERVER-SIDE by the caller (lib/pricing.calculatePrice),
--    keeping pricing logic in one place rather than re-implementing it in SQL.
-- ════════════════════════════════════════════════════════════════════
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
  -- Serialize concurrent attempts on the same TABLE (not table+date) so two
  -- lockers whose windows cross midnight onto adjacent dates still serialize
  -- against each other (transaction-scoped; released at commit).
  perform pg_advisory_xact_lock(hashtextextended(p_table_number::text, 0));

  v_req_start := p_date + p_start_time;
  v_req_end   := v_req_start + (p_duration_hours || ' hours')::interval;
  v_end_time  := (p_start_time + (p_duration_hours || ' hours')::interval)::time; -- wraps past midnight

  -- Unavailable if any BOOKED row, or any ACTIVE lock held by someone else,
  -- overlaps the requested window. Overlap uses real timestamps (handles midnight).
  if exists (
    select 1 from public.slots s
    where s.table_number = p_table_number
      -- ±1 day so a booking crossing midnight (e.g. 22:00 + 3h) is checked
      -- against neighbouring-day rows; the timestamp comparison below is exact.
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

  v_locked_until := now() + (p_lock_minutes || ' minutes')::interval;

  -- Reuse a row at this exact start (available, expired-lock, or our own lock);
  -- otherwise create one. Either path lands on status='locked' for this user.
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

-- ════════════════════════════════════════════════════════════════════
-- 2. release_slot_lock — free a held slot (e.g. on payment failure). Idempotent.
-- ════════════════════════════════════════════════════════════════════
create or replace function public.release_slot_lock(p_slot_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.slots
     set status = 'available', locked_by = null, locked_until = null
   where id = p_slot_id and status = 'locked';
  return jsonb_build_object('success', true, 'slot_id', p_slot_id);
end;
$$;

-- ════════════════════════════════════════════════════════════════════
-- 3. confirm_booking (jsonb overload) — atomic confirm + points award.
--    REPLACES the existing jsonb overload. Idempotent: a second call for an
--    already-confirmed booking returns the same payload without re-awarding points.
--
--    Points: tiers reward via multiplier only (revenue-neutral — matches
--    lib/pricing.applyTierPolicy). We INSERT into points_ledger, then UPDATE
--    users.points; that UPDATE fires update_tier_trigger (BEFORE UPDATE ON users)
--    which recomputes the tier. Never call update_member_tier directly.
-- ════════════════════════════════════════════════════════════════════
create or replace function public.confirm_booking(
  p_booking_id         uuid,
  p_payment_intent_id  text,
  p_payment_method     text,
  p_total_price        integer,
  p_is_free            boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings%rowtype;
  v_mult    numeric;
  v_pts     integer;
  v_ref     text;
begin
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then
    return jsonb_build_object('success', false, 'reason', 'booking_not_found');
  end if;

  -- Idempotent short-circuit (Stripe may deliver payment_intent.succeeded twice).
  if v_booking.status = 'confirmed' then
    return jsonb_build_object(
      'success', true, 'idempotent', true,
      'booking_id', v_booking.id, 'booking_reference', v_booking.booking_reference,
      'table_number', v_booking.table_number, 'date', v_booking.date,
      'start_time', v_booking.start_time, 'end_time', v_booking.end_time,
      'user_id', v_booking.user_id
    );
  end if;

  v_ref := coalesce(
    v_booking.booking_reference,
    '248-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
  );

  update public.bookings set
    status = 'confirmed',
    stripe_payment_intent = p_payment_intent_id,
    payment_method = p_payment_method,
    is_free_booking = p_is_free,
    total_price = coalesce(p_total_price, total_price),
    booking_reference = v_ref,
    updated_at = now()
  where id = p_booking_id;

  -- Mark the slot booked and clear the hold.
  update public.slots set status = 'booked', locked_by = null, locked_until = null
   where id = v_booking.slot_id;

  -- Award points (skip for free bookings and guests).
  if not coalesce(p_is_free, false) and v_booking.user_id is not null then
    select case u.tier when 'maximum' then 2 when 'century' then 1.5 else 1 end
      into v_mult
      from public.users u where u.id = v_booking.user_id;
    v_pts := round(coalesce(p_total_price, v_booking.total_price) * coalesce(v_mult, 1));
    if v_pts > 0 then
      insert into public.points_ledger (user_id, points, type, reference_id, note)
      values (v_booking.user_id, v_pts, 'booking', v_booking.id, 'Booking ' || v_ref);
      -- This UPDATE fires update_tier_trigger → recomputes users.tier from NEW.points.
      update public.users set points = points + v_pts where id = v_booking.user_id;
    end if;
  end if;

  return jsonb_build_object(
    'success', true,
    'booking_id', v_booking.id, 'booking_reference', v_ref,
    'table_number', v_booking.table_number, 'date', v_booking.date,
    'start_time', v_booking.start_time, 'end_time', v_booking.end_time,
    'user_id', v_booking.user_id
  );
end;
$$;

-- Drop the dead void overload (uuid, text, text) so the name is unambiguous.
-- Identity is by argument TYPES; this targets only the 3-arg version.
drop function if exists public.confirm_booking(uuid, text, text);

-- ════════════════════════════════════════════════════════════════════
-- 4. refund_booking — reverse a confirmed booking. Idempotent.
-- ════════════════════════════════════════════════════════════════════
create or replace function public.refund_booking(p_payment_intent_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings%rowtype;
  v_pts     integer;
begin
  select * into v_booking from public.bookings
   where stripe_payment_intent = p_payment_intent_id for update;
  if not found then
    return jsonb_build_object('success', false, 'reason', 'booking_not_found');
  end if;
  if v_booking.status = 'refunded' then
    return jsonb_build_object('success', true, 'idempotent', true, 'booking_id', v_booking.id);
  end if;

  update public.bookings set status = 'refunded', updated_at = now() where id = v_booking.id;

  -- Reverse exactly the points this booking earned.
  select coalesce(sum(points), 0) into v_pts
    from public.points_ledger where reference_id = v_booking.id and type = 'booking';
  if v_pts <> 0 and v_booking.user_id is not null then
    insert into public.points_ledger (user_id, points, type, reference_id, note)
    values (v_booking.user_id, -v_pts, 'manual', v_booking.id, 'Refund reversal');
    update public.users set points = greatest(0, points - v_pts) where id = v_booking.user_id;
  end if;

  -- Free the slot for resale.
  update public.slots set status = 'available', locked_by = null, locked_until = null
   where id = v_booking.slot_id;

  return jsonb_build_object('success', true, 'booking_id', v_booking.id);
end;
$$;

-- ════════════════════════════════════════════════════════════════════
-- 5. Expired-lock sweeper (pg_cron, every minute) — releases holds whose
--    locked_until has passed so abandoned carts don't block a slot for 15 min+.
-- ════════════════════════════════════════════════════════════════════
create or replace function public.release_expired_slot_locks()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.slots set status = 'available', locked_by = null, locked_until = null
   where status = 'locked' and locked_until < now();
end;
$$;

select cron.unschedule('release-expired-slot-locks')
  where exists (select 1 from cron.job where jobname = 'release-expired-slot-locks');

select cron.schedule('release-expired-slot-locks', '* * * * *',
  $$select public.release_expired_slot_locks();$$);

-- ════════════════════════════════════════════════════════════════════
-- 6. EXECUTE grants — these are invoked from API routes via the service-role
--    client (see lib/supabase/service.ts). Lock down to service_role.
-- ════════════════════════════════════════════════════════════════════
revoke all on function public.find_or_lock_slot(uuid, date, time, numeric, integer, integer, integer) from public, anon, authenticated;
revoke all on function public.release_slot_lock(uuid) from public, anon, authenticated;
revoke all on function public.refund_booking(text) from public, anon, authenticated;
grant execute on function public.find_or_lock_slot(uuid, date, time, numeric, integer, integer, integer) to service_role;
grant execute on function public.release_slot_lock(uuid) to service_role;
grant execute on function public.refund_booking(text) to service_role;
grant execute on function public.confirm_booking(uuid, text, text, integer, boolean) to service_role;
