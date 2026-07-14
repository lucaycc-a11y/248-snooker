-- 248 Snooker — self-serve "release my locks" for the /book slot picker.
-- Run in the Supabase SQL Editor for project wqmciwieiqvnswvspdyz. Idempotent.
--
-- WHY: a user whose own abandoned-checkout slot lock is now correctly shown
-- as "your booking in progress" (locked_by_you, see lib/booking/server.ts)
-- may want to abandon it and pick a different time instead of waiting out
-- the ~15-minute lock TTL / the once-a-minute release_expired_slot_locks
-- cron. release_my_locks() lets the API route free every active lock the
-- CALLING user holds in one call — scoped to auth.uid() server-side inside
-- the function, so (unlike release_slot_lock/release_group_locks, which
-- trust the caller to have already verified ownership) this one is safe to
-- expose more directly since it can only ever touch the caller's own rows.
--
-- WHAT: release_my_locks(p_user_id uuid) — frees every slots row where
-- status='locked' and locked_by = p_user_id. Returns the count released.

create or replace function public.release_my_locks(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  with released as (
    update public.slots
       set status = 'available', locked_by = null, locked_until = null
     where status = 'locked' and locked_by = p_user_id
    returning id
  )
  select count(*) into v_count from released;

  return jsonb_build_object('success', true, 'released', v_count);
end;
$$;

revoke all on function public.release_my_locks(uuid) from public, anon, authenticated;
grant execute on function public.release_my_locks(uuid) to service_role;
