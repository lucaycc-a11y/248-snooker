-- v8.0.52 (test): Space Pilot 頁加入平滑捲動（桌面滑鼠滾輪）。
INSERT INTO public.app_versions (version, released_at, adds, changes, removes) VALUES (
  '8.0.52', now() + interval '30 days',
  ARRAY['Space Pilot 頁加入平滑捲動（桌面滑鼠滾輪；觸控裝置及「減少動態」設定不受影響）'],
  ARRAY[]::text[],
  ARRAY[]::text[]
) ON CONFLICT (version) DO NOTHING;
