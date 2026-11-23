-- v8.0.29 (test): 會員頁輪流賽卡片（排名、MVP、逐場賽果、循環賽進度）。
INSERT INTO public.app_versions (version, released_at, adds, changes, removes) VALUES (
  '8.0.29', now() + interval '30 days',
  ARRAY['Space Pilot 會員頁：輪流賽卡片（排名表、MVP、逐場賽果、循環賽進度）'],
  ARRAY[]::text[],
  ARRAY[]::text[]
) ON CONFLICT (version) DO NOTHING;
