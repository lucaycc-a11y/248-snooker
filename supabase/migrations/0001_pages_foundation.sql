-- 248 Snooker — foundation tables for /legal /pricing /blog /about /member pages.
-- Run this in the Supabase SQL Editor for project wqmciwieiqvnswvspdyz.
-- Safe to re-run: every statement is idempotent.

-- ════════════════════════════════════════════════════════════════════
-- 1. config — single source of truth for prices, tiers, venue info.
--    key/value(jsonb) shape mirrors the existing public.bot_config table.
--    Prices live HERE, never hardcoded client-side.
-- ════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.config (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.config ENABLE ROW LEVEL SECURITY;

-- Public, read-only. Prices/tiers are not secret and must render in SSR
-- with the anon key. Writes are service_role only (admin API / SQL editor).
DROP POLICY IF EXISTS "config_public_read" ON public.config;
CREATE POLICY "config_public_read"
  ON public.config
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "config_service_role_write" ON public.config;
CREATE POLICY "config_service_role_write"
  ON public.config
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Seed values mirror the booking-flow skill (afternoon/late HK$60, evening HK$80,
-- tiers 0/500/1500). Edit these rows to change prices site-wide.
INSERT INTO public.config (key, value) VALUES
  ('site', jsonb_build_object(
      'currency', 'HKD',
      'maxHours', 6,
      'openHour', 0,
      'closeHour', 24
   )),
  ('pricing', jsonb_build_object(
      'currency', 'HKD',
      'maxHours', 6,
      'periods', jsonb_build_array(
        jsonb_build_object('id','afternoon','rate',60,'start','12:00','end','18:00','days','weekday'),
        jsonb_build_object('id','evening','rate',80,'start','18:00','end','24:00','days','all'),
        jsonb_build_object('id','latenight','rate',60,'start','00:00','end','06:00','days','all')
      ),
      'services', jsonb_build_object(
        'locker_single', 20,
        'locker_monthly', 600,
        'cue_pro_per_hour', 30,
        'overtime_per_15min', 50,
        'drinks_min', 8,
        'drinks_max', 18
      )
   )),
  ('tiers', jsonb_build_array(
      jsonb_build_object('id','amateur','minPts',0,'discount',1.0,'multiplier',1),
      jsonb_build_object('id','century','minPts',500,'discount',0.9,'multiplier',1.5),
      jsonb_build_object('id','maximum','minPts',1500,'discount',0.8,'multiplier',2)
   )),
  ('legal', jsonb_build_object('updatedAt', '2026-06-29'))
ON CONFLICT (key) DO NOTHING;


-- ════════════════════════════════════════════════════════════════════
-- 2. cms_content — optional per-locale text overrides.
--    Page copy ships in next-intl messages/*.json (fallback). Any row here
--    overrides a given data-cms-key at runtime without a redeploy.
-- ════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.cms_content (
  key text NOT NULL,
  locale text NOT NULL DEFAULT 'zh-HK',
  value text NOT NULL,
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (key, locale)
);

ALTER TABLE public.cms_content ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cms_public_read" ON public.cms_content;
CREATE POLICY "cms_public_read"
  ON public.cms_content
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "cms_service_role_write" ON public.cms_content;
CREATE POLICY "cms_service_role_write"
  ON public.cms_content
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');


-- ════════════════════════════════════════════════════════════════════
-- 3. blog_posts — localized blog (list + [slug]).
-- ════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.blog_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  locale text NOT NULL DEFAULT 'zh-HK',
  title text NOT NULL,
  excerpt text,
  content text,
  seo_title text,
  seo_description text,
  og_image_url text,
  cover_image_url text,
  category text,
  author text DEFAULT '248 Snooker',
  published_at timestamptz,
  reading_time integer DEFAULT 5,
  views integer DEFAULT 0,
  ai_generated boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE (slug, locale)
);

CREATE INDEX IF NOT EXISTS blog_posts_locale_published_idx
  ON public.blog_posts(locale, published_at DESC);
CREATE INDEX IF NOT EXISTS blog_posts_category_idx
  ON public.blog_posts(category);

ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

-- Anyone may read PUBLISHED posts (published_at set and in the past).
DROP POLICY IF EXISTS "blog_public_read" ON public.blog_posts;
CREATE POLICY "blog_public_read"
  ON public.blog_posts
  FOR SELECT
  USING (published_at IS NOT NULL AND published_at <= now());

-- service_role bypasses RLS, but keep an explicit admin write policy too.
DROP POLICY IF EXISTS "blog_service_role_write" ON public.blog_posts;
CREATE POLICY "blog_service_role_write"
  ON public.blog_posts
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- If an admin_users table exists, also let active admins manage posts from the
-- client (matches the policy requested in the spec). Guarded so this file runs
-- even when admin_users hasn't been created yet.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'admin_users'
  ) THEN
    DROP POLICY IF EXISTS "blog_admin_all" ON public.blog_posts;
    CREATE POLICY "blog_admin_all"
      ON public.blog_posts
      FOR ALL
      USING (EXISTS (
        SELECT 1 FROM public.admin_users
        WHERE user_id = auth.uid() AND is_active = true
      ));
  END IF;
END $$;
