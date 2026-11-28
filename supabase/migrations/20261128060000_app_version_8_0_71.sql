INSERT INTO public.app_versions (version, released_at, adds, changes, removes) VALUES (
  '8.0.71', now(),
  ARRAY[]::text[],
  ARRAY[]::text[],
  ARRAY['Space Pilot 頁面移除推出日期文字和倒數計時器；12 月 15 日自動移除 Beta 標示及更新 SEO／FAQ 的安排保留']
) ON CONFLICT (version) DO NOTHING;
