-- 248 Snooker — expire stale pending bookings + failed payment intents.
-- Run in Supabase SQL Editor for wqmciwieiqvnswvspdyz. Idempotent.
--
-- Marks bookings that are stuck in 'pending' or 'payment_failed' and whose
-- start_time has already passed as 'expired'. Also frees any stale slot locks
-- that these bookings held.
--
-- Does NOT use pg_cron (Vercel Edge-cron calls the API route instead), but
-- can be run from the SQL Editor for one-time cleanup.

CREATE OR REPLACE FUNCTION public.expire_stale_bookings()
RETURNS TABLE(expired_count integer, freed_slots integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expired integer;
  v_freed integer;
BEGIN
  -- Expire pending/failed bookings where the start time is past
  WITH expired AS (
    UPDATE public.bookings
    SET status = 'expired'
    WHERE status IN ('pending', 'payment_failed')
      AND (date < current_date
           OR (date = current_date AND start_time < (LOCALTIME - interval '1 hour')))
    RETURNING id, slot_id
  )
  SELECT count(*) INTO v_expired FROM expired;

  -- Free any stale slot locks held by those bookings
  WITH freed AS (
    UPDATE public.slots
    SET status = 'available',
        locked_by = NULL,
        locked_until = NULL
    WHERE id IN (
      SELECT e.slot_id
      FROM (SELECT slot_id FROM public.bookings WHERE status = 'expired') e
      WHERE e.slot_id IS NOT NULL
    )
    AND status = 'locked'
  )
  SELECT count(*) INTO v_freed FROM freed;

  -- Insert notification for affected users (non-fatal)
  INSERT INTO public.notification_log (user_id, type, message, meta)
  SELECT b.user_id, 'booking_expired',
         'Your booking ' || COALESCE(b.booking_reference, b.human_code, b.id::text) || ' has expired.',
         jsonb_build_object('booking_id', b.id, 'reason', 'stale')
  FROM public.bookings b
  WHERE b.status = 'expired'
    AND b.updated_at >= now() - interval '1 minute';

  expired_count := v_expired;
  freed_slots := v_freed;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_stale_bookings() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_stale_bookings() TO service_role;