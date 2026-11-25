INSERT INTO public.app_versions (version, released_at, adds, changes, removes) VALUES (
  '8.0.60', now(), ARRAY[]::text[],
  ARRAY['iOS App 管理員登入與網頁 /login 完全一致：以電郵對應、尚未綁定 user_id 的管理員也可登入'],
  ARRAY[]::text[]
) ON CONFLICT (version) DO NOTHING;
