-- ════════════════════════════════════════════════════════════════════════════
-- Space8 Member Redesign — Complete Database Schema
-- Migration: 20260921000000_member_redesign_complete.sql
-- Safe to re-run: idempotent DDL for all member-area tables and functions.
-- ════════════════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────────────────
-- § 1. TIER CONFIGURATION (config table extensions)
-- ────────────────────────────────────────────────────────────────────────────
-- Tiers are stored in the existing `config` table as a jsonb array under
-- key='member_tiers'. Each tier has:
--   id: 'amateur' | 'century' | 'maximum' (or custom)
--   name_zh_hk, name_zh_cn, name_en, name_ja: localized display names
--   min_lifetime_points: threshold to reach this tier
--   benefits: { discount: 0.9, multiplier: 1.5 }

INSERT INTO public.config (key, value) VALUES
  ('member_tiers', jsonb_build_array(
    jsonb_build_object(
      'id', 'amateur',
      'name_zh_hk', '業餘',
      'name_zh_cn', '业余',
      'name_en', 'Amateur',
      'name_ja', 'アマチュア',
      'min_lifetime_points', 0,
      'benefits', jsonb_build_object('discount', 1.0, 'multiplier', 1.0)
    ),
    jsonb_build_object(
      'id', 'century',
      'name_zh_hk', '世紀',
      'name_zh_cn', '世纪',
      'name_en', 'Century',
      'name_ja', 'センチュリー',
      'min_lifetime_points', 500,
      'benefits', jsonb_build_object('discount', 0.95, 'multiplier', 1.5)
    ),
    jsonb_build_object(
      'id', 'maximum',
      'name_zh_hk', '極限',
      'name_zh_cn', '极限',
      'name_en', 'Maximum',
      'name_ja', 'マキシマム',
      'min_lifetime_points', 2000,
      'benefits', jsonb_build_object('discount', 0.9, 'multiplier', 2.0)
    )
  )),
  ('member_settings', jsonb_build_object(
    'birthday_perk_advance_days', 30,
    'birthday_perk_multiplier', 2.0,
    'points_base_rate', 10
  ))
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();


-- ────────────────────────────────────────────────────────────────────────────
-- § 2. USERS TABLE EXTENSIONS
-- ────────────────────────────────────────────────────────────────────────────
-- The `users` table (auth.users mirror or separate public.users) needs these
-- columns. This migration assumes public.users exists. If it doesn't, the
-- columns will be added to auth.users via RPC or a separate auth schema migration.

DO $$ BEGIN
  -- Add columns if they don't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='users' AND column_name='points') THEN
    ALTER TABLE public.users ADD COLUMN points integer NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='users' AND column_name='lifetime_points') THEN
    ALTER TABLE public.users ADD COLUMN lifetime_points integer NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='users' AND column_name='tier_id') THEN
    ALTER TABLE public.users ADD COLUMN tier_id text NOT NULL DEFAULT 'amateur';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='users' AND column_name='birth_month') THEN
    ALTER TABLE public.users ADD COLUMN birth_month integer CHECK (birth_month >= 1 AND birth_month <= 12);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='users' AND column_name='birth_month_set_at') THEN
    ALTER TABLE public.users ADD COLUMN birth_month_set_at timestamptz;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='users' AND column_name='member_code') THEN
    ALTER TABLE public.users ADD COLUMN member_code text UNIQUE;
  END IF;
END $$;

-- Generate member codes for existing users without one
UPDATE public.users
SET member_code = '248-' || UPPER(SUBSTRING(REPLACE(CAST(id AS text), '-', ''), 1, 8))
WHERE member_code IS NULL;

COMMENT ON COLUMN public.users.points IS 'Available points balance (spendable)';
COMMENT ON COLUMN public.users.lifetime_points IS 'Lifetime points earned (high-water mark, drives tier)';
COMMENT ON COLUMN public.users.tier_id IS 'Current tier ID (amateur, century, maximum)';
COMMENT ON COLUMN public.users.birth_month IS 'Birth month (1-12), set once by user, locked after';
COMMENT ON COLUMN public.users.birth_month_set_at IS 'When birth_month was first set (for birthday perk eligibility)';


-- ────────────────────────────────────────────────────────────────────────────
-- § 3. POINTS LEDGER
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.points_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  delta integer NOT NULL, -- positive = earned, negative = spent/reversed
  balance_after integer NOT NULL, -- running balance snapshot
  category text NOT NULL CHECK (category IN ('booking', 'redeem', 'refund', 'manual', 'birthday')),
  description text NOT NULL,
  booking_id uuid, -- nullable: link to bookings table when category='booking'
  offer_id uuid, -- nullable: link to offers table when category='redeem'
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_points_ledger_user_created
  ON public.points_ledger(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_points_ledger_booking
  ON public.points_ledger(booking_id) WHERE booking_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_points_ledger_offer
  ON public.points_ledger(offer_id) WHERE offer_id IS NOT NULL;

ALTER TABLE public.points_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "points_ledger_user_read" ON public.points_ledger;
CREATE POLICY "points_ledger_user_read"
  ON public.points_ledger FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "points_ledger_service_write" ON public.points_ledger;
CREATE POLICY "points_ledger_service_write"
  ON public.points_ledger FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE public.points_ledger IS
  'Single source of truth for all points movements. No expiry. Ledger-only.';


-- ────────────────────────────────────────────────────────────────────────────
-- § 4. OFFERS TABLE
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title_zh_hk text NOT NULL,
  title_zh_cn text NOT NULL,
  title_en text NOT NULL,
  title_ja text NOT NULL,
  description_zh_hk text,
  description_zh_cn text,
  description_en text,
  description_ja text,
  discount_type text NOT NULL CHECK (discount_type IN ('fixed', 'percent', 'free_hour', 'birthday_perk')),
  discount_value numeric NOT NULL, -- e.g. 50 for HK$50 off, 20 for 20% off, 1 for 1 free hour
  min_booking_hours integer, -- minimum booking duration to apply
  state text NOT NULL DEFAULT 'issued' CHECK (state IN ('issued', 'ready', 'reserved', 'used', 'expired')),
  acquire_mode text NOT NULL CHECK (acquire_mode IN ('auto', 'claim', 'points')),
  points_cost integer, -- null if acquire_mode != 'points'
  issued_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz,
  expires_at timestamptz, -- null = no expiry
  reserved_booking_id uuid, -- when state='reserved', link to bookings
  used_at timestamptz,
  created_by text DEFAULT 'system' -- 'system', 'admin', 'campaign'
);

CREATE INDEX IF NOT EXISTS idx_offers_user_state
  ON public.offers(user_id, state, expires_at);
CREATE INDEX IF NOT EXISTS idx_offers_reserved_booking
  ON public.offers(reserved_booking_id) WHERE reserved_booking_id IS NOT NULL;

ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "offers_user_read" ON public.offers;
CREATE POLICY "offers_user_read"
  ON public.offers FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "offers_service_write" ON public.offers;
CREATE POLICY "offers_service_write"
  ON public.offers FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE public.offers IS
  'User-specific redeemable offers. Points redeem for offers, offers apply to bookings.';


-- ────────────────────────────────────────────────────────────────────────────
-- § 5. INBOX (NOTIFICATION_LOG)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('offer', 'booking', 'system', 'promo')),
  title_zh_hk text NOT NULL,
  title_zh_cn text NOT NULL,
  title_en text NOT NULL,
  title_ja text NOT NULL,
  message_zh_hk text,
  message_zh_cn text,
  message_en text,
  message_ja text,
  read boolean NOT NULL DEFAULT false,
  action_url text, -- deep link (e.g. /member?tab=rewards&offer=uuid)
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_log_user_created
  ON public.notification_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_log_unread
  ON public.notification_log(user_id, read) WHERE NOT read;

ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notification_log_user_read" ON public.notification_log;
CREATE POLICY "notification_log_user_read"
  ON public.notification_log FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notification_log_user_mark_read" ON public.notification_log;
CREATE POLICY "notification_log_user_mark_read"
  ON public.notification_log FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "notification_log_service_write" ON public.notification_log;
CREATE POLICY "notification_log_service_write"
  ON public.notification_log FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE public.notification_log IS
  'Inbox messages. Types: offer (new offer), booking (status change), system (admin), promo (marketing).';


-- ────────────────────────────────────────────────────────────────────────────
-- § 6. BIRTHDAY PERK USAGE TRACKING
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.birthday_perk_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  calendar_year integer NOT NULL,
  booking_id uuid NOT NULL,
  used_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, calendar_year)
);

CREATE INDEX IF NOT EXISTS idx_birthday_perk_user_year
  ON public.birthday_perk_usage(user_id, calendar_year);

ALTER TABLE public.birthday_perk_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "birthday_perk_user_read" ON public.birthday_perk_usage;
CREATE POLICY "birthday_perk_user_read"
  ON public.birthday_perk_usage FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "birthday_perk_service_write" ON public.birthday_perk_usage;
CREATE POLICY "birthday_perk_service_write"
  ON public.birthday_perk_usage FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE public.birthday_perk_usage IS
  'Tracks birthday perk usage once per HK calendar year per user.';


-- ────────────────────────────────────────────────────────────────────────────
-- § 7. BOOKINGS TABLE EXTENSIONS
-- ────────────────────────────────────────────────────────────────────────────
-- Add offer_id column to existing bookings table if it doesn't exist

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='bookings' AND column_name='offer_id') THEN
    ALTER TABLE public.bookings ADD COLUMN offer_id uuid REFERENCES public.offers(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='bookings' AND column_name='points_earned') THEN
    ALTER TABLE public.bookings ADD COLUMN points_earned integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='bookings' AND column_name='birthday_perk_used') THEN
    ALTER TABLE public.bookings ADD COLUMN birthday_perk_used boolean DEFAULT false;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bookings_offer ON public.bookings(offer_id) WHERE offer_id IS NOT NULL;

COMMENT ON COLUMN public.bookings.offer_id IS 'Link to redeemed offer (one per booking)';
COMMENT ON COLUMN public.bookings.points_earned IS 'Points awarded for this booking';
COMMENT ON COLUMN public.bookings.birthday_perk_used IS 'Whether birthday perk (×2 points) was applied';


-- ────────────────────────────────────────────────────────────────────────────
-- § 8. FUNCTIONS
-- ────────────────────────────────────────────────────────────────────────────

-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ award_points_for_booking                                                │
-- │ Awards points after a booking is confirmed. Called by webhook or admin. │
-- └─────────────────────────────────────────────────────────────────────────┘
CREATE OR REPLACE FUNCTION public.award_points_for_booking(
  p_booking_id uuid,
  p_user_id uuid,
  p_base_amount numeric,
  p_birthday_perk boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier_multiplier numeric;
  v_birthday_multiplier numeric;
  v_points_to_award integer;
  v_new_balance integer;
  v_new_lifetime integer;
  v_tier_id text;
BEGIN
  -- Get user's tier multiplier
  SELECT tier_id INTO v_tier_id FROM public.users WHERE id = p_user_id;

  SELECT (value->'benefits'->>'multiplier')::numeric INTO v_tier_multiplier
  FROM public.config, jsonb_array_elements(value) AS tier
  WHERE key = 'member_tiers' AND tier->>'id' = v_tier_id;

  IF v_tier_multiplier IS NULL THEN
    v_tier_multiplier := 1.0;
  END IF;

  -- Get birthday multiplier if applicable
  IF p_birthday_perk THEN
    SELECT (value->>'birthday_perk_multiplier')::numeric INTO v_birthday_multiplier
    FROM public.config WHERE key = 'member_settings';
    IF v_birthday_multiplier IS NULL THEN
      v_birthday_multiplier := 2.0;
    END IF;
  ELSE
    v_birthday_multiplier := 1.0;
  END IF;

  -- Calculate points
  v_points_to_award := FLOOR(p_base_amount * v_tier_multiplier * v_birthday_multiplier);

  -- Update user balance
  UPDATE public.users
  SET points = points + v_points_to_award,
      lifetime_points = lifetime_points + v_points_to_award
  WHERE id = p_user_id
  RETURNING points, lifetime_points INTO v_new_balance, v_new_lifetime;

  -- Insert ledger entry
  INSERT INTO public.points_ledger (user_id, delta, balance_after, category, description, booking_id)
  VALUES (
    p_user_id,
    v_points_to_award,
    v_new_balance,
    CASE WHEN p_birthday_perk THEN 'birthday' ELSE 'booking' END,
    CASE WHEN p_birthday_perk
         THEN '生日優惠 ×2 積分 | Birthday Perk ×2 Points'
         ELSE '訂場積分 | Booking Points'
    END,
    p_booking_id
  );

  -- Update booking record
  UPDATE public.bookings
  SET points_earned = v_points_to_award,
      birthday_perk_used = p_birthday_perk
  WHERE id = p_booking_id;

  -- Check tier upgrade
  PERFORM public.check_tier_upgrade(p_user_id, v_new_lifetime);
END;
$$;

COMMENT ON FUNCTION public.award_points_for_booking IS
  'Awards points for a confirmed booking with tier and birthday multipliers.';


-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ check_tier_upgrade                                                      │
-- │ Checks if user qualifies for tier upgrade based on lifetime points.    │
-- └─────────────────────────────────────────────────────────────────────────┘
CREATE OR REPLACE FUNCTION public.check_tier_upgrade(
  p_user_id uuid,
  p_lifetime_points integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_tier_id text;
  v_old_tier_id text;
BEGIN
  SELECT tier_id INTO v_old_tier_id FROM public.users WHERE id = p_user_id;

  -- Find highest tier user qualifies for
  SELECT tier->>'id' INTO v_new_tier_id
  FROM public.config, jsonb_array_elements(value) AS tier
  WHERE key = 'member_tiers'
    AND (tier->>'min_lifetime_points')::integer <= p_lifetime_points
  ORDER BY (tier->>'min_lifetime_points')::integer DESC
  LIMIT 1;

  IF v_new_tier_id IS NOT NULL AND v_new_tier_id != v_old_tier_id THEN
    UPDATE public.users SET tier_id = v_new_tier_id WHERE id = p_user_id;

    -- Send notification
    INSERT INTO public.notification_log (user_id, type, title_zh_hk, title_zh_cn, title_en, title_ja, message_zh_hk, message_zh_cn, message_en, message_ja)
    VALUES (
      p_user_id,
      'system',
      '會籍升級！',
      '会籍升级！',
      'Tier Upgraded!',
      'ティアがアップグレードされました！',
      '恭喜！您的會籍已升級至 ' || v_new_tier_id,
      '恭喜！您的会籍已升级至 ' || v_new_tier_id,
      'Congratulations! Your tier has been upgraded to ' || v_new_tier_id,
      'おめでとうございます！ティアが ' || v_new_tier_id || ' にアップグレードされました'
    );
  END IF;
END;
$$;

COMMENT ON FUNCTION public.check_tier_upgrade IS
  'Checks for tier upgrade and sends notification if upgraded.';


-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ redeem_offer_with_points                                                │
-- │ User spends points to unlock an offer.                                  │
-- └─────────────────────────────────────────────────────────────────────────┘
CREATE OR REPLACE FUNCTION public.redeem_offer_with_points(
  p_user_id uuid,
  p_offer_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_points_cost integer;
  v_user_points integer;
  v_new_balance integer;
  v_offer_state text;
BEGIN
  -- Check offer exists and is redeemable
  SELECT state, points_cost INTO v_offer_state, v_points_cost
  FROM public.offers
  WHERE id = p_offer_id AND user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'offer_not_found');
  END IF;

  IF v_offer_state != 'issued' THEN
    RETURN jsonb_build_object('success', false, 'error', 'offer_already_redeemed');
  END IF;

  IF v_points_cost IS NULL OR v_points_cost <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'offer_not_points_redeemable');
  END IF;

  -- Check user has enough points
  SELECT points INTO v_user_points FROM public.users WHERE id = p_user_id;

  IF v_user_points < v_points_cost THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_points');
  END IF;

  -- Deduct points
  UPDATE public.users
  SET points = points - v_points_cost
  WHERE id = p_user_id
  RETURNING points INTO v_new_balance;

  -- Record ledger entry
  INSERT INTO public.points_ledger (user_id, delta, balance_after, category, description, offer_id)
  VALUES (
    p_user_id,
    -v_points_cost,
    v_new_balance,
    'redeem',
    '兌換優惠 | Redeem Offer',
    p_offer_id
  );

  -- Update offer state
  UPDATE public.offers
  SET state = 'ready', claimed_at = now()
  WHERE id = p_offer_id;

  RETURN jsonb_build_object('success', true, 'new_balance', v_new_balance);
END;
$$;

COMMENT ON FUNCTION public.redeem_offer_with_points IS
  'User spends points to unlock a points-based offer.';


-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ claim_offer                                                             │
-- │ User claims an auto-issued offer (state: issued → ready).              │
-- └─────────────────────────────────────────────────────────────────────────┘
CREATE OR REPLACE FUNCTION public.claim_offer(
  p_user_id uuid,
  p_offer_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offer_state text;
  v_acquire_mode text;
BEGIN
  SELECT state, acquire_mode INTO v_offer_state, v_acquire_mode
  FROM public.offers
  WHERE id = p_offer_id AND user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'offer_not_found');
  END IF;

  IF v_offer_state != 'issued' THEN
    RETURN jsonb_build_object('success', false, 'error', 'offer_already_claimed');
  END IF;

  IF v_acquire_mode != 'claim' THEN
    RETURN jsonb_build_object('success', false, 'error', 'offer_not_claimable');
  END IF;

  UPDATE public.offers
  SET state = 'ready', claimed_at = now()
  WHERE id = p_offer_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

COMMENT ON FUNCTION public.claim_offer IS
  'User claims an issued offer (acquire_mode=claim).';


-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ get_available_offers                                                    │
-- │ Returns offers the user can use (state=ready, not expired).            │
-- └─────────────────────────────────────────────────────────────────────────┘
CREATE OR REPLACE FUNCTION public.get_available_offers(p_user_id uuid)
RETURNS TABLE (
  id uuid,
  title_zh_hk text,
  title_zh_cn text,
  title_en text,
  title_ja text,
  discount_type text,
  discount_value numeric,
  expires_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, title_zh_hk, title_zh_cn, title_en, title_ja, discount_type, discount_value, expires_at
  FROM public.offers
  WHERE user_id = p_user_id
    AND state = 'ready'
    AND (expires_at IS NULL OR expires_at > now())
  ORDER BY expires_at NULLS LAST, issued_at DESC;
$$;

COMMENT ON FUNCTION public.get_available_offers IS
  'Returns ready, non-expired offers for a user.';


-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ check_birthday_perk_eligibility                                         │
-- │ Returns true if user can use birthday perk this calendar year.         │
-- └─────────────────────────────────────────────────────────────────────────┘
CREATE OR REPLACE FUNCTION public.check_birthday_perk_eligibility(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_birth_month integer;
  v_birth_month_set_at timestamptz;
  v_advance_days integer;
  v_current_year integer;
  v_used_this_year boolean;
BEGIN
  -- Check birth month is set and meets advance requirement
  SELECT birth_month, birth_month_set_at INTO v_birth_month, v_birth_month_set_at
  FROM public.users WHERE id = p_user_id;

  IF v_birth_month IS NULL THEN
    RETURN false;
  END IF;

  SELECT (value->>'birthday_perk_advance_days')::integer INTO v_advance_days
  FROM public.config WHERE key = 'member_settings';

  IF v_advance_days IS NULL THEN
    v_advance_days := 30;
  END IF;

  IF v_birth_month_set_at IS NULL OR v_birth_month_set_at > (now() - (v_advance_days || ' days')::interval) THEN
    RETURN false;
  END IF;

  -- Check not used this calendar year
  v_current_year := EXTRACT(YEAR FROM now() AT TIME ZONE 'Asia/Hong_Kong');

  SELECT EXISTS(
    SELECT 1 FROM public.birthday_perk_usage
    WHERE user_id = p_user_id AND calendar_year = v_current_year
  ) INTO v_used_this_year;

  RETURN NOT v_used_this_year;
END;
$$;

COMMENT ON FUNCTION public.check_birthday_perk_eligibility IS
  'Returns true if user can use birthday perk (×2 points) this calendar year.';


-- ────────────────────────────────────────────────────────────────────────────
-- § 9. GRANT PERMISSIONS
-- ────────────────────────────────────────────────────────────────────────────
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.config TO anon, authenticated;
GRANT SELECT ON public.users TO authenticated;
GRANT SELECT ON public.points_ledger TO authenticated;
GRANT SELECT ON public.offers TO authenticated;
GRANT SELECT ON public.notification_log TO authenticated;
GRANT UPDATE (read) ON public.notification_log TO authenticated;

GRANT EXECUTE ON FUNCTION public.award_points_for_booking TO service_role;
GRANT EXECUTE ON FUNCTION public.check_tier_upgrade TO service_role;
GRANT EXECUTE ON FUNCTION public.redeem_offer_with_points TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_offer TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_available_offers TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_birthday_perk_eligibility TO authenticated, service_role;
