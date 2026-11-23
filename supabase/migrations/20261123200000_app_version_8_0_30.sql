-- v8.0.30 (test): 新增 /spacepilot 介紹頁（Beta，僅管理員）及導航分頁。
INSERT INTO public.app_versions (version, released_at, adds, changes, removes) VALUES (
  '8.0.30', now() + interval '30 days',
  ARRAY['Space Pilot 介紹頁 /spacepilot（Beta，僅管理員可見）：牆上 iPad 捲動動畫、雙房連線、功能介紹','主頁導航新增 Space Pilot 分頁（僅管理員）'],
  ARRAY['會員頁 Space Pilot 介紹分頁（僅管理員）'],
  ARRAY[]::text[]
) ON CONFLICT (version) DO NOTHING;
