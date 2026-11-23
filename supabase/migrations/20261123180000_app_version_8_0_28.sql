-- v8.0.28 (test): /cam 直播至 iPad 及 iPad 遙控錄影。
INSERT INTO public.app_versions (version, released_at, adds, changes, removes) VALUES (
  '8.0.28', now() + interval '30 days',
  ARRAY['/cam 手機鏡頭可直播至 iPad（WebRTC），iPad 可遙控開始／停止錄影'],
  ARRAY[]::text[],
  ARRAY[]::text[]
) ON CONFLICT (version) DO NOTHING;
