-- Supabase RPCs — §12.
-- admin_waive_booking, generate_ai_daily_insights.
-- All SECURITY DEFINER, service_role only.

-- ============================================================
-- 1. admin_waive_booking
-- Cancels a booking atomically: status change + cancellation_log + optional points compensation.
-- ============================================================
DO $$ BEGIN
  CREATE OR REPLACE FUNCTION public.admin_waive_booking(
    p_booking_id uuid,
    p_admin_id uuid,
    p_reason text,
    p_compensation_type text DEFAULT 'none',
    p_compensation_value numeric DEFAULT 0
  )
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $func$
  DECLARE
    v_booking record;
    v_admin_email text;
    v_user_id uuid;
  BEGIN
    -- 1. Validate inputs
    IF p_compensation_type NOT IN ('none', 'points', 'refund') THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid compensation_type');
    END IF;

    IF p_compensation_type = 'points' AND (p_compensation_value IS NULL OR p_compensation_value <= 0) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Points compensation requires positive value');
    END IF;

    -- 2. Fetch booking
    SELECT * INTO v_booking
    FROM public.bookings
    WHERE id = p_booking_id;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Booking not found');
    END IF;

    IF v_booking.status IN ('admin_cancelled', 'cancelled') THEN
      RETURN jsonb_build_object('success', false, 'error', 'Booking already cancelled');
    END IF;

    -- 3. Get admin email
    SELECT email INTO v_admin_email
    FROM public.admin_users
    WHERE user_id = p_admin_id
    LIMIT 1;

    v_user_id := v_booking.user_id;

    -- 4. Cancel booking (atomic)
    UPDATE public.bookings
    SET status = 'admin_cancelled',
        updated_at = now()
    WHERE id = p_booking_id;

    -- 5. Log cancellation
    INSERT INTO public.cancellation_log (
      booking_id, admin_id, reason, compensation_type, compensation_value
    ) VALUES (
      p_booking_id, p_admin_id, p_reason, p_compensation_type, p_compensation_value
    );

    -- 6. Award points if compensation_type = 'points'
    IF p_compensation_type = 'points' AND p_compensation_value > 0 THEN
      UPDATE public.users
      SET points = COALESCE(points, 0) + p_compensation_value
      WHERE id = v_user_id;

      INSERT INTO public.points_ledger (
        user_id, points, type, reference_id, note
      ) VALUES (
        v_user_id, p_compensation_value, 'admin_grant',
        p_booking_id, COALESCE(p_reason, 'Admin waiver compensation')
      );
    END IF;

    -- 7. Audit log
    INSERT INTO public.admin_action_log (
      admin_user_id, admin_email, action_type, target_table,
      target_id, before_jsonb, after_jsonb, risk_level, confirmed_by
    ) VALUES (
      p_admin_id, v_admin_email, 'booking_admin_cancel', 'bookings',
      p_booking_id,
      jsonb_build_object('status', v_booking.status),
      jsonb_build_object(
        'status', 'admin_cancelled',
        'compensation_type', p_compensation_type,
        'compensation_value', p_compensation_value,
        'reason', p_reason
      ),
      'high',
      p_admin_id
    );

    RETURN jsonb_build_object(
      'success', true,
      'booking_id', p_booking_id,
      'new_status', 'admin_cancelled',
      'compensation_type', p_compensation_type,
      'compensation_value', p_compensation_value
    );
  END;
  $func$;

  REVOKE EXECUTE ON FUNCTION public.admin_waive_booking(uuid, uuid, text, text, numeric)
    FROM public, anon, authenticated;
  GRANT EXECUTE ON FUNCTION public.admin_waive_booking(uuid, uuid, text, text, numeric)
    TO service_role;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;


-- ============================================================
-- 2. generate_ai_daily_insights
-- Reads previous day's data, generates insights, stores in ai_daily_insights.
-- ============================================================
DO $$ BEGIN
  CREATE OR REPLACE FUNCTION public.generate_ai_daily_insights()
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $func$
  DECLARE
    v_yesterday date := CURRENT_DATE - interval '1 day';
    v_insights jsonb;
    v_booking_count integer;
    v_revenue numeric;
    v_cancel_count integer;
    v_new_users integer;
  BEGIN
    -- 1. Count yesterday's bookings
    SELECT count(*) INTO v_booking_count
    FROM public.bookings
    WHERE created_at >= v_yesterday
      AND created_at < v_yesterday + interval '1 day';

    -- 2. Sum revenue (from bookings with confirmed/completed status)
    SELECT COALESCE(sum(total_price), 0) INTO v_revenue
    FROM public.bookings
    WHERE status IN ('confirmed', 'completed')
      AND created_at >= v_yesterday
      AND created_at < v_yesterday + interval '1 day';

    -- 3. Count cancellations
    SELECT count(*) INTO v_cancel_count
    FROM public.bookings
    WHERE status IN ('cancelled', 'admin_cancelled')
      AND updated_at >= v_yesterday
      AND updated_at < v_yesterday + interval '1 day';

    -- 4. Count new users
    SELECT count(*) INTO v_new_users
    FROM public.users
    WHERE created_at >= v_yesterday
      AND created_at < v_yesterday + interval '1 day';

    -- 5. Build insights JSON
    v_insights := jsonb_build_object(
      'date', v_yesterday,
      'bookings', v_booking_count,
      'revenue_hkd', v_revenue,
      'cancellations', v_cancel_count,
      'new_users', v_new_users,
      'cancellation_rate', CASE
        WHEN v_booking_count > 0
        THEN round((v_cancel_count::numeric / v_booking_count) * 100, 1)
        ELSE 0
      END,
      'generated_at', now()
    );

    -- 6. Upsert into ai_daily_insights (one row per date)
    INSERT INTO public.ai_daily_insights (date, insights, generated_at)
    VALUES (v_yesterday, v_insights, now())
    ON CONFLICT (date) DO UPDATE
    SET insights = EXCLUDED.insights,
        generated_at = EXCLUDED.generated_at;

    RETURN v_insights;
  END;
  $func$;

  REVOKE EXECUTE ON FUNCTION public.generate_ai_daily_insights()
    FROM public, anon, authenticated;
  GRANT EXECUTE ON FUNCTION public.generate_ai_daily_insights()
    TO service_role;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
