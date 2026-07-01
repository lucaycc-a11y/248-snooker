-- 248 Snooker — cross-midnight slot overlap tests.
-- Paste into Supabase SQL Editor. This script wraps all writes in a transaction
-- and ends with ROLLBACK so it leaves no test slots behind.
--
-- It tests public.find_or_lock_slot's real overlap behavior for cross-midnight
-- windows. Expected: all assertions pass; any failure raises an exception.

begin;

-- Use far-future dates and high table numbers to avoid colliding with live rows;
-- ROLLBACK at the end removes any rows inserted by find_or_lock_slot.
do $$
declare
  v_user_a uuid := gen_random_uuid();
  v_user_b uuid := gen_random_uuid();
  v_result jsonb;
begin
  -- Case 1: Existing 23:00–01:00 (+1 day), request 00:30–01:30 next day.
  -- Must be rejected because the real timestamp windows overlap.
  v_result := public.find_or_lock_slot(v_user_a, date '2099-12-31', time '23:00', 2, 998, 100, 15);
  if coalesce((v_result->>'success')::boolean, false) is not true then
    raise exception 'case 1 setup failed: %', v_result;
  end if;

  v_result := public.find_or_lock_slot(v_user_b, date '2100-01-01', time '00:30', 1, 998, 100, 15);
  if coalesce((v_result->>'success')::boolean, true) is not false
     or v_result->>'reason' <> 'unavailable' then
    raise exception 'case 1 failed: expected unavailable overlap, got %', v_result;
  end if;

  -- Case 2: Existing 23:00–01:00 (+1 day), request 02:00–03:00 next day.
  -- Must be allowed: adjacent/non-overlapping after midnight.
  v_result := public.find_or_lock_slot(v_user_b, date '2100-01-01', time '02:00', 1, 998, 100, 15);
  if coalesce((v_result->>'success')::boolean, false) is not true then
    raise exception 'case 2 failed: expected non-overlap allowed, got %', v_result;
  end if;

  -- Case 3: Existing next-day 00:30–01:30, request previous-day 23:00–01:00.
  -- Must be rejected. This verifies the ±1 day scan catches rows on the next date.
  v_result := public.find_or_lock_slot(v_user_a, date '2100-01-02', time '00:30', 1, 999, 100, 15);
  if coalesce((v_result->>'success')::boolean, false) is not true then
    raise exception 'case 3 setup failed: %', v_result;
  end if;

  v_result := public.find_or_lock_slot(v_user_b, date '2100-01-01', time '23:00', 2, 999, 100, 15);
  if coalesce((v_result->>'success')::boolean, true) is not false
     or v_result->>'reason' <> 'unavailable' then
    raise exception 'case 3 failed: expected next-day overlap unavailable, got %', v_result;
  end if;

  -- Case 4: Same table, same neighbouring date scan, but no time overlap.
  -- Must be allowed, proving the ±1 day scan is not over-broad.
  v_result := public.find_or_lock_slot(v_user_b, date '2100-01-01', time '20:00', 1, 999, 100, 15);
  if coalesce((v_result->>'success')::boolean, false) is not true then
    raise exception 'case 4 failed: expected isolated non-overlap allowed, got %', v_result;
  end if;

  raise notice 'All cross-midnight find_or_lock_slot overlap assertions passed.';
end $$;

rollback;
