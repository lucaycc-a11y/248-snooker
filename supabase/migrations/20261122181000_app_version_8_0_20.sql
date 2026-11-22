-- v8.0.20 (test): Space Pilot 網頁全面使用 Good Times 字體。
INSERT INTO public.app_versions (version, released_at, adds, changes, removes) VALUES (
  '8.0.20', now() + interval '30 days',
  ARRAY[]::text[],
  ARRAY['Space Pilot 會員頁、巡場頁、/extend、/p 改用 Good Times 字體'],
  ARRAY[]::text[]
) ON CONFLICT (version) DO NOTHING;
