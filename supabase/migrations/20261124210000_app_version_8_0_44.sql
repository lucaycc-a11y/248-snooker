-- v8.0.44 (test): Space Pilot 頁公開（Beta）。
INSERT INTO public.app_versions (version, released_at, adds, changes, removes) VALUES (
  '8.0.44', now() + interval '30 days',
  ARRAY['Space Pilot 頁面公開（Beta 標示），導覽列所有訪客可見，並加入 sitemap'],
  ARRAY['Space Pilot 常見問題「現在誰可以使用」改為公開 Beta 說明','頁面標題加入 Beta'],
  ARRAY[]::text[]
) ON CONFLICT (version) DO NOTHING;
