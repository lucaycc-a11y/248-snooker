-- v8.0.42 (test): Space Pilot 首頁移除重複的 Beta 提示膠囊。
INSERT INTO public.app_versions (version, released_at, adds, changes, removes) VALUES (
  '8.0.42', now() + interval '30 days',
  ARRAY[]::text[],
  ARRAY['Space Pilot 首頁精簡：移除與頂部 BETA 標籤重複的「Beta 測試中」提示'],
  ARRAY[]::text[]
) ON CONFLICT (version) DO NOTHING;
