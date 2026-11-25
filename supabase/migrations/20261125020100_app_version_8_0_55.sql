INSERT INTO public.app_versions (version, released_at, adds, changes, removes) VALUES (
  '8.0.55', now(),
  ARRAY['iOS 管理員 App API：預約列表／詳情、收入、搜尋、通知列表、推送裝置註冊','新預約即時推送通知（APNs）給所有管理員'],
  ARRAY[]::text[],
  ARRAY[]::text[]
) ON CONFLICT (version) DO NOTHING;
