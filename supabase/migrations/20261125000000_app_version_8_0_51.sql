-- v8.0.51 (test): Space Pilot 頁隱藏「精彩片段」相關內容。
INSERT INTO public.app_versions (version, released_at, adds, changes, removes) VALUES (
  '8.0.51', now() + interval '30 days',
  ARRAY[]::text[],
  ARRAY['Space Pilot 頁面文字精簡：移除「精彩片段」相關說明'],
  ARRAY['Space Pilot 頁移除「精彩片段」功能卡、常見問題及搜尋資料中的錄影字眼']
) ON CONFLICT (version) DO NOTHING;
