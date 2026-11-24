-- v8.0.47 (test): Space Pilot 首屏排版優化，文字區隨螢幕高度縮放，按鈕不再壓住 iPad。
INSERT INTO public.app_versions (version, released_at, adds, changes, removes) VALUES (
  '8.0.47', now() + interval '30 days',
  ARRAY[]::text[],
  ARRAY['Space Pilot 首屏排版：標題及說明文字隨螢幕高度縮放，與 iPad 保留間距，按鈕不再壓住 iPad'],
  ARRAY[]::text[]
) ON CONFLICT (version) DO NOTHING;
