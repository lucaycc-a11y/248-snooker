INSERT INTO public.app_versions (version, released_at, adds, changes, removes) VALUES (
  '8.0.66', now(),
  ARRAY['Space Pilot 頁面：2026 年 12 月 15 日推出倒數（日／時／分／秒），推出後自動轉為「現已推出」'],
  ARRAY['Space Pilot：12 月 15 日（香港時間）零時自動移除 Beta 標示，並更新頁面標題、描述、FAQ、結構化資料；llms.txt 加入推出日期'],
  ARRAY[]::text[]
) ON CONFLICT (version) DO NOTHING;
