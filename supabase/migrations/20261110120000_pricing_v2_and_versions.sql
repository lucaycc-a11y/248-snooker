-- Pricing v2 (連訂) + 20-minute booking cutoff + app version history.
-- Additive only. Both tables are service-role only (RLS on, no policies) so the
-- new prices are NOT readable through the public anon API before go-live
-- (public.config is world-readable, so these deliberately do not live there).

CREATE TABLE IF NOT EXISTS public.pricing_v2_config (
  id             boolean PRIMARY KEY DEFAULT true CHECK (id),
  public_from    timestamptz NOT NULL,
  cutoff_minutes integer NOT NULL DEFAULT 20 CHECK (cutoff_minutes BETWEEN 0 AND 60),
  combo_min_hours integer NOT NULL DEFAULT 2 CHECK (combo_min_hours >= 2),
  combo_rates    jsonb NOT NULL,
  updated_at     timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pricing_v2_config ENABLE ROW LEVEL SECURITY;

INSERT INTO public.pricing_v2_config (id, public_from, cutoff_minutes, combo_min_hours, combo_rates)
VALUES (true, '2026-11-11T00:00:00+08:00', 20, 2,
        '{"morning":75,"afternoon":85,"evening":95}'::jsonb)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.app_versions (
  version     text PRIMARY KEY,
  released_at timestamptz NOT NULL,
  adds        text[] NOT NULL DEFAULT '{}',
  changes     text[] NOT NULL DEFAULT '{}',
  removes     text[] NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.app_versions ENABLE ROW LEVEL SECURITY;

INSERT INTO public.app_versions (version, released_at, adds, changes, removes) VALUES (
  '8.0.1', '2026-11-11T00:00:00+08:00',
  ARRAY['連訂價錢（同一天預訂 2 小時或以上按連訂價計）','條款內加入連訂說明','FAQ 價錢提示及彈出說明','Admin 版本記錄頁'],
  ARRAY['預訂緩衝由 15 分鐘改為 20 分鐘','所有價錢位置改為新價目表及連訂註解'],
  ARRAY['舊有單一價目顯示']
) ON CONFLICT (version) DO NOTHING;
