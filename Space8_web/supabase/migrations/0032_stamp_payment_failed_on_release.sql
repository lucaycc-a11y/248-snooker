-- Makes release_slot_lock / release_group_locks also stamp the booking row(s)
-- as 'payment_failed' when a Stripe payment_intent.payment_failed webhook
-- fires. Previously these RPCs only freed the slot for resale and left
-- bookings.status stuck at 'pending' forever — the member dashboard had no
-- way to distinguish "still checking out" from "payment actually failed".
--
-- Only touches rows currently 'pending' (guards against a race where the
-- booking already moved on to 'confirmed'/'refunded'/'admin_cancelled' by
-- the time this fires — payment_intent.payment_failed should never arrive
-- after payment_intent.succeeded for the same intent, but webhook delivery
-- order isn't guaranteed, so don't clobber a later state).
--
-- Depends on 0031_payment_failed_status.sql (adds 'payment_failed' to the
-- status check constraint). Idempotent — safe to re-run.

-- ═══════════════════════════════════════════════════════════════════════════
-- release_slot_lock — free a held slot AND mark its booking payment_failed.
-- ═══════════════════════════════════════════════════════════════════════════
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

  update public.bookings
     set status = 'payment_failed', updated_at = now()
   where slot_id = p_slot_id and status = 'pending';

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
-- release_group_locks — same, for a grouped (multi-slot) checkout.
-- ═══════════════════════════════════════════════════════════════════════════
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

  update public.bookings
     set status = 'payment_failed', updated_at = now()
   where order_group_id = p_order_group_id and status = 'pending';

  if p_event_id is not null then
    update public.webhook_events set status = 'processed', processed_at = now()
     where id = p_event_id;
  end if;

  return jsonb_build_object('success', true, 'order_group_id', p_order_group_id);
end;
$$;

revoke all on function public.release_group_locks(uuid, text) from public, anon, authenticated;
grant execute on function public.release_group_locks(uuid, text) to service_role;
