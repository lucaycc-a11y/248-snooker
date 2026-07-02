-- 248 Snooker — self-serve partial refund + reschedule from /member.
-- Run in the Supabase SQL Editor for project wqmciwieiqvnswvspdyz. Idempotent.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- WHY:
--   /member currently only displays bookings read-only. Members need a way to
--   request a refund (minus Stripe's processing fee, blocked inside a cutoff
--   window before start time) or reschedule (free, must be before start time,
--   subject to the new slot being free) without contacting staff.
--
-- WHAT:
--   1. bookings: 6 new columns (refund_amount, refund_fee, refunded_at,
--      rescheduled_at, reschedule_count, cancellation_reason).
--   2. config: new 'booking_rules' row (refundCutoffHours).
--   3. request_booking_refund(p_booking_id, p_reason) — NEW function, distinct
--      from the existing refund_booking(p_payment_intent_id, p_event_id),
--      which stays untouched as the admin/Stripe-dashboard full-refund path
--      (webhook's handleRefunded). This one computes a partial refund (price
--      minus Stripe fee), enforces the cutoff, and is called directly from an
--      authenticated API route — no webhook/event-id involved.
--   4. reschedule_booking(p_booking_id, p_new_start, p_new_end,
--      p_new_table_number) — NEW function. Free (no re-pricing), moves the
--      booking's existing slots row in place after an overlap check.
--   Both are service_role-only, matching every other booking RPC.
-- ═══════════════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────────
-- 1. Schema: refund + reschedule columns on bookings
-- ────────────────────────────────────────────────────────────────────
alter table public.bookings
  add column if not exists refund_amount       integer,
  add column if not exists refund_fee          integer,
  add column if not exists refunded_at         timestamptz,
  add column if not exists rescheduled_at      timestamptz,
  add column if not exists reschedule_count    integer not null default 0,
  add column if not exists cancellation_reason text;

-- ────────────────────────────────────────────────────────────────────
-- 2. config seed — refund cutoff window. ON CONFLICT DO NOTHING so a re-run
--    never clobbers an admin-edited value.
-- ────────────────────────────────────────────────────────────────────
insert into public.config (key, value)
values ('booking_rules', jsonb_build_object('refundCutoffHours', 1))
on conflict (key) do nothing;

-- ════════════════════════════════════════════════════════════════════
-- 3. request_booking_refund — user-initiated partial refund.
--    Distinct from refund_booking (admin/webhook, full refund, keyed by
--    payment_intent). This one is keyed by booking_id, computes the
--    Stripe-fee-adjusted amount, and enforces a cutoff window read from
--    config.booking_rules. Returns the payment intent id in the payload so
--    the calling API route can call stripe.refunds.create() without a
--    second query.
-- ════════════════════════════════════════════════════════════════════
create or replace function public.request_booking_refund(
  p_booking_id uuid,
  p_reason     text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking       public.bookings%rowtype;
  v_cutoff_hours  numeric;
  v_start_ts      timestamp;
  v_stripe_fee    integer;
  v_refund_amount integer;
  v_pts           integer;
begin
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then
    return jsonb_build_object('success', false, 'reason', 'booking_not_found');
  end if;

  -- Also blocks double-refunding a booking already refunded via the admin
  -- webhook path (refund_booking/refund_group set the same status).
  if v_booking.status <> 'confirmed' then
    return jsonb_build_object(
      'success', false,
      'reason', case when v_booking.status = 'refunded' then 'already_refunded' else 'not_refundable' end
    );
  end if;

  -- Serialize against concurrent slot operations on this table (same rule
  -- as find_or_lock_slot / find_or_lock_slots).
  perform pg_advisory_xact_lock(hashtextextended(v_booking.table_number::text, 0));

  select coalesce((value->>'refundCutoffHours')::numeric, 1)
    into v_cutoff_hours
    from public.config where key = 'booking_rules';
  v_cutoff_hours := coalesce(v_cutoff_hours, 1);

  v_start_ts := v_booking.date + v_booking.start_time;
  if v_start_ts <= now() + (v_cutoff_hours || ' hours')::interval then
    raise exception 'refund_cutoff_closed:%:%', p_booking_id, v_start_ts
      using errcode = 'P0001';
  end if;

  -- Partial refund: price minus an approximation of Stripe's processing fee
  -- (3.4% + HK$2.35), never below zero. HK$ whole-dollar integers, matching
  -- bookings.total_price's type.
  v_stripe_fee    := round(v_booking.total_price * 0.034 + 2.35, 0)::integer;
  v_refund_amount := greatest(0, v_booking.total_price - v_stripe_fee);

  update public.bookings set
    status              = 'refunded',
    refund_amount       = v_refund_amount,
    refund_fee          = v_stripe_fee,
    refunded_at         = now(),
    cancellation_reason = p_reason,
    updated_at          = now()
  where id = p_booking_id;

  -- Reverse exactly the points this booking earned (same convention as
  -- refund_booking).
  select coalesce(sum(points), 0) into v_pts
    from public.points_ledger
   where reference_id = v_booking.id and type = 'booking';
  if v_pts <> 0 and v_booking.user_id is not null then
    insert into public.points_ledger (user_id, points, type, reference_id, note)
    values (v_booking.user_id, -v_pts, 'manual', v_booking.id, 'Refund reversal');
    update public.users set points = greatest(0, points - v_pts) where id = v_booking.user_id;
  end if;

  -- Free the slot for resale.
  update public.slots set status = 'available', locked_by = null, locked_until = null
   where id = v_booking.slot_id;

  return jsonb_build_object(
    'success', true,
    'booking_id', v_booking.id,
    'refund_amount', v_refund_amount,
    'refund_fee', v_stripe_fee,
    'original_price', v_booking.total_price,
    'stripe_payment_intent', v_booking.stripe_payment_intent
  );
end;
$$;

-- ════════════════════════════════════════════════════════════════════
-- 4. reschedule_booking — user-initiated, free reschedule to a new
--    date/time/table. Must be before the booking's current start_time.
--    Moves the booking's existing slots row in place (slot_id stays stable)
--    after an overlap check against other booked/locked rows, same style as
--    find_or_lock_slot. No re-pricing: total_price/period are untouched.
-- ════════════════════════════════════════════════════════════════════
create or replace function public.reschedule_booking(
  p_booking_id       uuid,
  p_new_start        timestamptz,
  p_new_end          timestamptz,
  p_new_table_number integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking      public.bookings%rowtype;
  v_new_date     date;
  v_new_start    time;
  v_new_end      time;
  v_new_duration numeric;
begin
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then
    return jsonb_build_object('success', false, 'reason', 'booking_not_found');
  end if;

  if v_booking.status <> 'confirmed' then
    return jsonb_build_object('success', false, 'reason', 'not_reschedulable');
  end if;

  if (v_booking.date + v_booking.start_time) <= now() then
    return jsonb_build_object('success', false, 'reason', 'already_started');
  end if;

  v_new_date     := p_new_start::date;
  v_new_start    := p_new_start::time;
  v_new_duration := extract(epoch from (p_new_end - p_new_start)) / 3600;
  v_new_end      := (v_new_start + (v_new_duration || ' hours')::interval)::time;

  -- Advisory locks are reentrant/stackable per transaction, so locking both
  -- the destination and (if different) origin table is safe even if equal.
  perform pg_advisory_xact_lock(hashtextextended(p_new_table_number::text, 0));
  if p_new_table_number <> v_booking.table_number then
    perform pg_advisory_xact_lock(hashtextextended(v_booking.table_number::text, 0));
  end if;

  -- Unavailable if any other booked row or active lock overlaps the new
  -- window (excludes the booking's own slot row).
  if exists (
    select 1 from public.slots s
    where s.table_number = p_new_table_number
      and s.id <> v_booking.slot_id
      and s.date between (v_new_date - 1) and (v_new_date + 1)
      and (
        s.status = 'booked'
        or (s.status = 'locked' and s.locked_until > now())
      )
      and (s.date + s.start_time) < p_new_end
      and (s.date + s.start_time + (s.duration_hours || ' hours')::interval) > p_new_start
  ) then
    raise exception 'slot_unavailable:%:%', p_new_table_number, p_new_start
      using errcode = 'P0001';
  end if;

  update public.slots set
    table_number   = p_new_table_number,
    date           = v_new_date,
    start_time     = v_new_start,
    end_time       = v_new_end,
    duration_hours = v_new_duration,
    status         = 'booked'
  where id = v_booking.slot_id;

  update public.bookings set
    date             = v_new_date,
    start_time       = v_new_start,
    end_time         = v_new_end,
    duration_hours   = v_new_duration,
    table_number     = p_new_table_number,
    rescheduled_at   = now(),
    reschedule_count = reschedule_count + 1,
    updated_at       = now()
  where id = p_booking_id;

  return jsonb_build_object(
    'success', true,
    'booking_id', p_booking_id,
    'date', v_new_date,
    'start_time', v_new_start,
    'end_time', v_new_end,
    'table_number', p_new_table_number,
    'reschedule_count', v_booking.reschedule_count + 1
  );
end;
$$;

-- ════════════════════════════════════════════════════════════════════
-- 5. Grants — service_role only (invoked from new API routes via the
--    service-role client, matching every other booking RPC).
-- ════════════════════════════════════════════════════════════════════
revoke all on function public.request_booking_refund(uuid, text) from public, anon, authenticated;
revoke all on function public.reschedule_booking(uuid, timestamptz, timestamptz, integer) from public, anon, authenticated;

grant execute on function public.request_booking_refund(uuid, text) to service_role;
grant execute on function public.reschedule_booking(uuid, timestamptz, timestamptz, integer) to service_role;
