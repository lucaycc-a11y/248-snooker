-- Coupon & campaign tables: coupon_templates, user_coupons, campaigns, campaign_claims, referrals.

-- ============================================================
-- 1. coupon_templates
-- ============================================================
CREATE TABLE IF NOT EXISTS public.coupon_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  discount_type text NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value numeric NOT NULL CHECK (discount_value > 0),
  max_uses integer,
  used_count integer NOT NULL DEFAULT 0,
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.coupon_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS coupon_templates_service_role_all ON public.coupon_templates;
CREATE POLICY coupon_templates_service_role_all ON public.coupon_templates
  FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS coupon_templates_active_idx ON public.coupon_templates (is_active, valid_from, valid_until);

-- ============================================================
-- 2. user_coupons
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_template_id uuid NOT NULL REFERENCES public.coupon_templates(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL,
  is_used boolean NOT NULL DEFAULT false,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_coupons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_coupons_service_role_all ON public.user_coupons;
CREATE POLICY user_coupons_service_role_all ON public.user_coupons
  FOR ALL USING (true) WITH CHECK (true);

CREATE UNIQUE INDEX IF NOT EXISTS user_coupons_code_idx ON public.user_coupons (code);
CREATE INDEX IF NOT EXISTS user_coupons_user_idx ON public.user_coupons (user_id, is_used);

-- ============================================================
-- 3. campaigns
-- ============================================================
CREATE TABLE IF NOT EXISTS public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'ended')),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS campaigns_service_role_all ON public.campaigns;
CREATE POLICY campaigns_service_role_all ON public.campaigns
  FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS campaigns_status_idx ON public.campaigns (status, starts_at, ends_at);

-- ============================================================
-- 4. campaign_claims
-- ============================================================
CREATE TABLE IF NOT EXISTS public.campaign_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT campaign_claims_unique UNIQUE (campaign_id, user_id)
);

ALTER TABLE public.campaign_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS campaign_claims_service_role_all ON public.campaign_claims;
CREATE POLICY campaign_claims_service_role_all ON public.campaign_claims
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 5. referrals
-- ============================================================
CREATE TABLE IF NOT EXISTS public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  coupon_template_id uuid REFERENCES public.coupon_templates(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'converted', 'expired')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS referrals_service_role_all ON public.referrals;
CREATE POLICY referrals_service_role_all ON public.referrals
  FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS referrals_referrer_idx ON public.referrals (referrer_id, status);
CREATE INDEX IF NOT EXISTS referrals_referred_idx ON public.referrals (referred_id);
