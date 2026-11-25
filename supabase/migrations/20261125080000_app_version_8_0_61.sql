INSERT INTO public.app_versions (version, released_at, adds, changes, removes) VALUES (
  '8.0.61', now(),
  ARRAY['iOS App 直接使用網頁登入（/auth/app-handoff）：網頁 /login 登入後交回 App'],
  ARRAY[]::text[], ARRAY[]::text[]
) ON CONFLICT (version) DO NOTHING;
