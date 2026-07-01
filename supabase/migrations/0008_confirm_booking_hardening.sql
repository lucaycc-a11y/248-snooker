-- 248 Snooker — confirm_booking hardening (P0 security fix) + atomic idempotency.
-- Run in the Supabase SQL Editor for project wqmciwieiqvnswvspdyz. Idempotent.
--
-- ⚠️ BACKUP BEFORE RUNNING: this REPLACES confirm_booking with a NEW SIGNATURE
-- (drops the 5-arg overload). Dump the current definition first:
--   select pg_get_functiondef(oid) from pg_proc where proname = 'confirm_booking';
--
-- ═══════════════════════════════════════════════════════════════════════════
-- WHY (P0 — verified against code, not speculative):
--
--   In 0004 every sibling RPC (find_or_lock_slot, release_slot_lock,
--   refund_booking) pairs its `grant execute ... to service_role` with an
--   explicit `revoke all ... from public, anon, authenticated`. confirm_booking
--   got ONLY the grant (0004 line 302). Postgres grants EXECUTE to PUBLIC by
--   default at CREATE FUNCTION, so that default was never stripped — anon AND
--   authenticated could call confirm_booking directly via PostgREST/supabase-js.
--
--   Worse, the old signature trusted the CALLER for money + free status:
--     confirm_booking(p_booking_id, p_payment_intent_id, p_payment_method,
--                     p_total_price, p_is_free)
--   Anyone reaching it could pass p_is_free := true + an arbitrary p_booking_id
--   to mark ANY pending booking confirmed-and-free, bypassing Stripe entirely,
--   and pass an arbitrary p_total_price that gets written verbatim.
--
-- WHAT THIS MIGRATION DOES:
--   1. New signature: confirm_booking(p_booking_id, p_payment_intent_id,
--      p_payment_method, p_qr_code, p_event_id text default null). Money + free status are
--      NO LONGER caller inputs — they are read from the bookings row itself:
--        * price  → bookings.total_price (computed server-side at create-intent)
--        * is_free→ bookings.is_free_booking (admin-flagged at row creation;
--                   self-serve inserts false — see create-intent/route.ts)
--   2. Locks EXECUTE down to service_role only (the actual P0 fix), and also
--      revokes the OLD 5-arg overload from anon/authenticated in case a live copy
--      lingers before the drop below runs.
--   3. Task 4 atomicity: when p_event_id is supplied, the function stamps
--      webhook_events.status='processed' for that event id INSIDE the same
--      transaction as the booking write, so "booking confirmed but event not
--      marked processed" can never happen (which would let Stripe's retry
--      re-run). The webhook stops doing that UPDATE post-hoc on success.
--
-- Comp/free bookings: no user-facing OR admin route calls confirm_booking or
-- sets is_free today (verified: app/admin/** has no such call). A comp is flagged
-- by setting bookings.is_free_booking = true at row-creation time (admin-only,
-- server-side), which this function then reads. There is no self-serve free path.
-- ═══════════════════════════════════════════════════════════════════════════

-- Drop the old 5-arg overload (can't remove params via CREATE OR REPLACE) and
-- the dead void 3-arg (uuid,text,text) variant if it still exists. Identity is
-- by argument TYPES, so these target only those exact overloads.
drop function if exists public.confirm_booking(uuid, text, text, integer, boolean);

-- Defense-in-depth: strip any lingering PUBLIC/anon/authenticated grant on the
-- OLD signature before it's dropped above has fully propagated across sessions.
-- (No-op if the drop already removed it.)
do $$
begin
  execute 'revoke all on function public.confirm_booking(uuid, text, text, integer, boolean) from public, anon, authenticated';
exception when undefined_function then
  null; -- already dropped, nothing to revoke
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- confirm_booking (new signature) — atomic confirm + points, no caller-trusted
-- money. Idempotent: a second call for an already-confirmed booking returns the
-- same payload without re-awarding points (Stripe may deliver succeeded twice).
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.confirm_booking(
  p_booking_id         uuid,
  p_payment_intent_id  text,
  p_payment_method     text,
  p_qr_code            text,
  p_event_id           text default null   -- Stripe event.id, for atomic idempotency
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
  v_is_free boolean;
  v_price   integer;
begin
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then
    return jsonb_build_object('success', false, 'reason', 'booking_not_found');
  end if;

  -- Idempotent short-circuit (unchanged — this was correct). Still stamp the
  -- event processed so a duplicate delivery of an already-handled booking also
  -- closes out its webhook_events row in-transaction.
  if v_booking.status = 'confirmed' then
    -- If a previous attempt confirmed the booking but failed before storing the
    -- QR credential, repair that missing local side effect on retry before the
    -- event is marked processed.
    update public.bookings
       set qr_code = coalesce(qr_code, p_qr_code), updated_at = now()
     where id = p_booking_id and qr_code is null;
    if p_event_id is not null then
      update public.webhook_events
         set status = 'processed', processed_at = now()
       where id = p_event_id;
    end if;
    return jsonb_build_object(
      'success', true, 'idempotent', true,
      'booking_id', v_booking.id, 'booking_reference', v_booking.booking_reference,
      'table_number', v_booking.table_number, 'date', v_booking.date,
      'start_time', v_booking.start_time, 'end_time', v_booking.end_time,
      'user_id', v_booking.user_id
    );
  end if;

  -- Money + free status are read from the booking row, NEVER from the caller.
  v_price   := v_booking.total_price;                     -- server-set at create-intent
  v_is_free := coalesce(v_booking.is_free_booking, false); -- admin-flagged; self-serve = false

  v_ref := coalesce(
    v_booking.booking_reference,
    '248-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
  );

  update public.bookings set
    status = 'confirmed',
    stripe_payment_intent = p_payment_intent_id,
    payment_method = p_payment_method,
    qr_code = p_qr_code,
    -- total_price and is_free_booking are intentionally NOT overwritten — the
    -- values set at booking creation are authoritative.
    booking_reference = v_ref,
    updated_at = now()
  where id = p_booking_id;

  -- Mark the slot booked and clear the hold.
  update public.slots set status = 'booked', locked_by = null, locked_until = null
   where id = v_booking.slot_id;

  -- Award points (skip for free bookings and guests). Uses the booking's own
  -- price × tier multiplier — matches lib/pricing.applyTierPolicy.
  if not v_is_free and v_booking.user_id is not null then
    select case u.tier when 'maximum' then 2 when 'century' then 1.5 else 1 end
      into v_mult
      from public.users u where u.id = v_booking.user_id;
    v_pts := round(coalesce(v_price, 0) * coalesce(v_mult, 1));
    if v_pts > 0 then
      insert into public.points_ledger (user_id, points, type, reference_id, note)
      values (v_booking.user_id, v_pts, 'booking', v_booking.id, 'Booking ' || v_ref);
      -- This UPDATE fires update_tier_trigger → recomputes users.tier from NEW.points.
      update public.users set points = points + v_pts where id = v_booking.user_id;
    end if;
  end if;

  -- Task 4: stamp the webhook event processed IN THIS TRANSACTION so the booking
  -- write and the idempotency record commit together (or neither does).
  if p_event_id is not null then
    update public.webhook_events
       set status = 'processed', processed_at = now()
     where id = p_event_id;
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

-- ═══════════════════════════════════════════════════════════════════════════
-- Grants — the actual P0 fix. Only the webhook (service_role) may call this.
-- ═══════════════════════════════════════════════════════════════════════════
revoke all on function public.confirm_booking(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.confirm_booking(uuid, text, text, text, text) to service_role;
