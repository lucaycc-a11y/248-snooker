-- v8.0.48 (test): Space Pilot 頁內文的房間名稱改用 Good Times 品牌字體。
INSERT INTO public.app_versions (version, released_at, adds, changes, removes) VALUES (
  '8.0.48', now() + interval '30 days',
  ARRAY[]::text[],
  ARRAY['Space Pilot 頁「雙房連線」及常見問題內文中的 Space Infinity / Space Eternity 改用 Good Times 品牌字體'],
  ARRAY[]::text[]
) ON CONFLICT (version) DO NOTHING;
