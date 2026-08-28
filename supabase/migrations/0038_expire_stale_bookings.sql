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
  v_expired_ids uuid[];
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
  SELECT count(*), coalesce(array_agg(id), '{}'::uuid[]) INTO v_expired, v_expired_ids FROM expired;

  -- Free only the slots belonging to rows expired by this invocation. Looking
  -- up every historical expired booking could release a newer lock that was
  -- acquired after an old booking was expired.
  WITH freed AS (
    UPDATE public.slots s
    SET status = 'available',
        locked_by = NULL,
        locked_until = NULL
    WHERE s.id IN (
      SELECT b.slot_id FROM public.bookings b WHERE b.id = ANY(v_expired_ids) AND b.slot_id IS NOT NULL
    )
      AND s.status = 'locked'
    RETURNING s.id
  )
  SELECT count(*) INTO v_freed FROM freed;

  -- Insert notifications only for rows expired by this invocation.
  INSERT INTO public.notification_log (user_id, type, message, meta)
  SELECT b.user_id, 'booking_expired',
         'Your booking ' || COALESCE(b.booking_reference, b.human_code, b.id::text) || ' has expired.',
         jsonb_build_object('booking_id', b.id, 'reason', 'stale')
  FROM public.bookings b
  WHERE b.id = ANY(v_expired_ids)
    AND NOT EXISTS (
    SELECT 1 FROM public.notification_log n
    WHERE n.booking_id = b.id AND n.type = 'booking_expired'
  );

  expired_count := v_expired;
  freed_slots := v_freed;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_stale_bookings() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_stale_bookings() TO service_role;