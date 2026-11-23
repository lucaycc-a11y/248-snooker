-- v8.0.26 (test): 全站繁體中文書面語；新增 Space Pilot 資料及 AI 訓練聲明。
INSERT INTO public.app_versions (version, released_at, adds, changes, removes) VALUES (
  '8.0.26', now() + interval '30 days',
  ARRAY['法律頁新增「Space Pilot 資料及 AI 訓練聲明」（繁中／簡中／英文）'],
  ARRAY['網站繁體中文文案統一為書面語','修正繁體文案中誤用的簡體字'],
  ARRAY[]::text[]
) ON CONFLICT (version) DO NOTHING;
