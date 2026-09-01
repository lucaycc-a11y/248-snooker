-- Phase 12 + Phase 7: generate_ai_daily_insights() RPC + pg_cron
-- SECURITY DEFINER — only callable by service_role (cron, admin API)
-- Reads previous day's bookings, revenue, payments → generates insights JSON → INSERT into ai_daily_insights

CREATE OR REPLACE FUNCTION public.generate_ai_daily_insights()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_yesterday date := current_date - interval '1 day';
  v_total_bookings bigint;
  v_confirmed_bookings bigint;
  v_cancelled_bookings bigint;
  v_total_revenue numeric := 0;
  v_total_payments bigint;
  v_failed_payments bigint;
  v_peak_hour integer;
  v_peak_hour_count bigint;
  v_summary text;
  v_highlights text[];
  v_insights jsonb;
BEGIN
  -- ── Aggregate previous day's bookings ──────────────────────────────────
  SELECT
    count(*),
    count(*) FILTER (WHERE status IN ('confirmed', 'completed')),
    count(*) FILTER (WHERE status IN ('cancelled', 'admin_cancelled'))
  INTO v_total_bookings, v_confirmed_bookings, v_cancelled_bookings
  FROM bookings
  WHERE date = v_yesterday;

  -- ── Aggregate previous day's revenue ───────────────────────────────────
  SELECT COALESCE(sum(amount), 0)
  INTO v_total_revenue
  FROM payment_attempts
  WHERE status = 'completed'
    AND date(completed_at) = v_yesterday;

  -- ── Aggregate previous day's payments ──────────────────────────────────
  SELECT
    count(*),
    count(*) FILTER (WHERE status = 'failed')
  INTO v_total_payments, v_failed_payments
  FROM payment_attempts
  WHERE date(created_at) = v_yesterday;

  -- ── Find peak hour ────────────────────────────────────────────────────
  SELECT
    extract(hour from start_time)::integer,
    count(*)
  INTO v_peak_hour, v_peak_hour_count
  FROM bookings
  WHERE date = v_yesterday
  GROUP BY extract(hour from start_time)
  ORDER BY count(*) DESC
  LIMIT 1;

  -- ── Build summary text ────────────────────────────────────────────────
  v_summary := format(
    'Yesterday (%s): %s bookings (%s confirmed, %s cancelled), HK$%s revenue from %s payments (%s failed).',
    to_char(v_yesterday, 'Mon DD'),
    v_total_bookings,
    v_confirmed_bookings,
    v_cancelled_bookings,
    to_char(v_total_revenue, 'FM999,999'),
    v_total_payments,
    v_failed_payments
  );

  -- ── Build highlights ──────────────────────────────────────────────────
  v_highlights := ARRAY[]::text[];

  IF v_peak_hour IS NOT NULL THEN
    v_highlights := array_append(v_highlights,
      format('Peak hour: %s:00 with %s bookings', v_peak_hour, v_peak_hour_count)
    );
  END IF;

  IF v_cancelled_bookings > 0 THEN
    v_highlights := array_append(v_highlights,
      format('%s cancellations (%s%% of total)', v_cancelled_bookings,
        round(v_cancelled_bookings::numeric / greatest(v_total_bookings, 1) * 100, 1))
    );
  END IF;

  IF v_failed_payments > 0 THEN
    v_highlights := array_append(v_highlights,
      format('%s failed payments out of %s', v_failed_payments, v_total_payments)
    );
  END IF;

  IF v_total_revenue > 0 THEN
    v_highlights := array_append(v_highlights,
      format('Total revenue: HK$%s', to_char(v_total_revenue, 'FM999,999'))
    );
  END IF;

  IF v_total_bookings = 0 THEN
    v_highlights := array_append(v_highlights, 'No bookings recorded for yesterday.');
  END IF;

  -- ── Assemble insights JSONB ───────────────────────────────────────────
  v_insights := jsonb_build_object(
    'summary', v_summary,
    'highlights', to_jsonb(v_highlights),
    'metrics', jsonb_build_object(
      'total_bookings', v_total_bookings,
      'confirmed_bookings', v_confirmed_bookings,
      'cancelled_bookings', v_cancelled_bookings,
      'total_revenue', v_total_revenue,
      'total_payments', v_total_payments,
      'failed_payments', v_failed_payments,
      'peak_hour', v_peak_hour
    ),
    'date', to_char(v_yesterday, 'YYYY-MM-DD')
  );

  -- ── Upsert into ai_daily_insights ─────────────────────────────────────
  INSERT INTO ai_daily_insights (date, insights, generated_at)
  VALUES (v_yesterday, v_insights, now())
  ON CONFLICT (date) DO UPDATE SET
    insights = EXCLUDED.insights,
    generated_at = EXCLUDED.generated_at;

  RAISE NOTICE 'ai_daily_insights generated for %: %', v_yesterday, v_summary;
END;
$$;

-- ── Revoke from public roles — service_role only ────────────────────────
REVOKE ALL ON FUNCTION public.generate_ai_daily_insights() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_ai_daily_insights() TO service_role;

-- ── Schedule via pg_cron: daily at 03:00 HKT (19:00 UTC previous day) ──
-- HKT = UTC+8, so 03:00 HKT = 19:00 UTC
SELECT cron.schedule(
  'generate-ai-daily-insights',
  '0 19 * * *',   -- 19:00 UTC = 03:00 HKT
  $$SELECT public.generate_ai_daily_insights();$$
);
