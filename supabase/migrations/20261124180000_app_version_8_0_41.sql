-- v8.0.41 (test): /join 加入頁改用網站主 Logo。
INSERT INTO public.app_versions (version, released_at, adds, changes, removes) VALUES (
  '8.0.41', now() + interval '30 days',
  ARRAY[]::text[],
  ARRAY['Space Pilot 加入頁（/join）標誌改為網站主 Logo'],
  ARRAY[]::text[]
) ON CONFLICT (version) DO NOTHING;
