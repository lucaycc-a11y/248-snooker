-- v8.0.35 (test): 會員 Space Pilot 頁載入加速；Space Pilot 介紹頁新增會員入口。
INSERT INTO public.app_versions (version, released_at, adds, changes, removes) VALUES (
  '8.0.35', now() + interval '30 days',
  ARRAY['Space Pilot 介紹頁新增「進入我的 Space Pilot」按鈕（首屏及頁尾）'],
  ARRAY['會員 Space Pilot 頁：各區塊同時載入、骨架畫面、上次資料即時顯示、相片延遲載入'],
  ARRAY[]::text[]
) ON CONFLICT (version) DO NOTHING;
