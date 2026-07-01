-- 248 Snooker — close the find_or_lock_slot() privilege-escalation gap.
--
-- CONTEXT: a prior hotfix ran `grant execute on function find_or_lock_slot(...)
-- to authenticated` to unblock 100% of users hitting "permission denied" —
-- but the app has NEVER called this RPC as `authenticated`. It is only ever
-- invoked server-side via the service-role client (lib/supabase/service.ts,
-- see app/api/booking/lock/route.ts), which already resolves p_user_id from
-- auth.getUser() and never trusts client input. The `authenticated` grant was
-- therefore pure attack surface: it let any logged-in browser call the RPC
-- directly via PostgREST/supabase-js and pass an arbitrary p_user_id to lock
-- someone else's slot.
--
-- FIX: revoke the unneeded authenticated grant (closes the hole outright,
-- restores the pre-hotfix-bug state), PLUS a null-safe in-function guard as
-- defense-in-depth in case this or another RPC is ever granted to
-- `authenticated` again. NOTE: auth.uid() is NULL under the service-role JWT
-- (no `sub` claim) — a bare `p_user_id is distinct from auth.uid()` check
-- would reject every legitimate service-role call, reintroducing the outage
-- this migration is meant to prevent. The guard below only fires when
-- auth.uid() is actually set (i.e. the caller has a user JWT).

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

-- Restore lockdown to service_role only — the app never calls this as
-- `authenticated`; that grant was attack surface added by the earlier hotfix.
revoke all on function public.find_or_lock_slot(uuid, date, time, numeric, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.find_or_lock_slot(uuid, date, time, numeric, integer, integer, integer) to service_role;
