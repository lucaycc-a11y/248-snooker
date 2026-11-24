-- v8.0.34 (test): 場地守則新增「設施不得帶離」條款。
INSERT INTO public.app_versions (version, released_at, adds, changes, removes) VALUES (
  '8.0.34', now() + interval '30 days',
  ARRAY['場地守則新增「設施不得帶離」：iPad 等設施屬本公司財產，擅自帶走將報警並須賠償重置費用'],
  ARRAY[]::text[],
  ARRAY[]::text[]
) ON CONFLICT (version) DO NOTHING;
