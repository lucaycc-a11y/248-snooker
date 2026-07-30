-- 248 Snooker — webhook idempotency hardening for failure/refund events.
-- Run in the Supabase SQL Editor for project wqmciwieiqvnswvspdyz. Idempotent.
--
-- WHY:
--   The Stripe webhook route claims webhook_events(event.id) before dispatching.
--   Before this migration, payment_failed/refunded handlers performed business
--   logic first, then the route marked webhook_events.status='processed' as a
--   separate DB statement. If the route crashed between those two statements,
--   Stripe's retry could re-run the business side.
--
-- WHAT:
--   Recreate release_slot_lock and refund_booking with optional p_event_id. When
--   supplied by the webhook, each function stamps webhook_events.status='processed'
--   inside the same transaction as the slot/booking mutation. This matches
--   confirm_booking from 0008.

-- ═══════════════════════════════════════════════════════════════════════════
-- release_slot_lock — free a held slot (e.g. payment_intent.payment_failed).
-- ═══════════════════════════════════════════════════════════════════════════
drop function if exists public.release_slot_lock(uuid);

create or replace function public.release_slot_lock(
  p_slot_id uuid,
  p_event_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.slots
     set status = 'available', locked_by = null, locked_until = null
   where id = p_slot_id and status = 'locked';

  if p_event_id is not null then
    update public.webhook_events
       set status = 'processed', processed_at = now()
     where id = p_event_id;
  end if;

  return jsonb_build_object('success', true, 'slot_id', p_slot_id);
end;
$$;

revoke all on function public.release_slot_lock(uuid, text) from public, anon, authenticated;
grant execute on function public.release_slot_lock(uuid, text) to service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- refund_booking — reverse a confirmed booking. Idempotent.
-- ═══════════════════════════════════════════════════════════════════════════
drop function if exists public.refund_booking(text);

create or replace function public.refund_booking(
  p_payment_intent_id text,
  p_event_id text default null
)
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
    if p_event_id is not null then
      update public.webhook_events
         set status = 'processed', processed_at = now()
       where id = p_event_id;
    end if;
    return jsonb_build_object('success', true, 'idempotent', true, 'booking_id', v_booking.id);
  end if;

  update public.bookings
     set status = 'refunded', updated_at = now()
   where id = v_booking.id;

  -- Reverse exactly the points this booking earned.
  select coalesce(sum(points), 0) into v_pts
    from public.points_ledger
   where reference_id = v_booking.id and type = 'booking';

  if v_pts <> 0 and v_booking.user_id is not null then
    insert into public.points_ledger (user_id, points, type, reference_id, note)
    values (v_booking.user_id, -v_pts, 'manual', v_booking.id, 'Refund reversal');
    update public.users
       set points = greatest(0, points - v_pts)
     where id = v_booking.user_id;
  end if;

  -- Free the slot for resale.
  update public.slots
     set status = 'available', locked_by = null, locked_until = null
   where id = v_booking.slot_id;

  if p_event_id is not null then
    update public.webhook_events
       set status = 'processed', processed_at = now()
     where id = p_event_id;
  end if;

  return jsonb_build_object('success', true, 'booking_id', v_booking.id);
end;
$$;

revoke all on function public.refund_booking(text, text) from public, anon, authenticated;
grant execute on function public.refund_booking(text, text) to service_role;
