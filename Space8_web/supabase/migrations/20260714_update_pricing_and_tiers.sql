-- Update `config` pricing periods, service fees, and membership tiers to the
-- 2026-07-14 rate card + tier restructure. 0001_pages_foundation.sql seeded
-- the original rows with ON CONFLICT DO NOTHING (so re-running it never
-- updates existing rows) — this migration explicitly UPSERTs the new values
-- so the single source of truth (this table) actually changes.
--
-- New rate card:
--   06:00–12:00  HK$88/h  (HK$78/h for bookings of 2h+)
--   12:00–16:00  HK$98/h  (HK$88/h for bookings of 2h+)
--   16:00–00:00  HK$108/h
-- New tiers:
--   Amateur   0pt+     — 1x points, HK$1 = 1pt, 50pt signup bonus
--   Century   800pt+   — 1.5x points, welcome lighting, 2 water bottles/booking
--   Maximum   6000pt+  — 2x points, merch gifts, coach booking, discount vouchers

INSERT INTO public.config (key, value, updated_at) VALUES
  ('pricing', jsonb_build_object(
      'currency', 'HKD',
      'maxHours', 6,
      'periods', jsonb_build_array(
        jsonb_build_object('id','morning','rate',88,'discountRate',78,'discountMinHours',2,'start','06:00','end','12:00','days','all'),
        jsonb_build_object('id','afternoon','rate',98,'discountRate',88,'discountMinHours',2,'start','12:00','end','16:00','days','all'),
        jsonb_build_object('id','evening','rate',108,'start','16:00','end','24:00','days','all')
      ),
      'services', jsonb_build_object(
        'locker_single', 20,
        'locker_monthly', 600,
        'cue_pro_per_hour', 30,
        'overtime_per_15min', 50,
        'drinks_min', 8,
        'drinks_max', 18
      )
   ), now()),
  ('tiers', jsonb_build_array(
      jsonb_build_object('id','amateur','minPts',0,'discount',1.0,'multiplier',1,'signupBonus',50),
      jsonb_build_object('id','century','minPts',800,'discount',1.0,'multiplier',1.5),
      jsonb_build_object('id','maximum','minPts',6000,'discount',1.0,'multiplier',2)
   ), now())
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value,
      updated_at = EXCLUDED.updated_at;
