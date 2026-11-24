-- v8.0.50 (test): 以最新版 Space Pilot iPad 截圖更換網站現有畫面。
INSERT INTO public.app_versions (version, released_at, adds, changes, removes) VALUES (
  '8.0.50', now() + interval '30 days',
  ARRAY[]::text[],
  ARRAY['Space Pilot 介紹頁、首頁及場地頁的 iPad 畫面更換為最新版截圖（主畫面、新比賽、計分板、勝利畫面）','「雙房連線」區兩部 iPad 改用 Infinity／Eternity 實際畫面，並加上示意說明'],
  ARRAY[]::text[]
) ON CONFLICT (version) DO NOTHING;
