INSERT INTO public.app_versions (version, released_at, adds, changes, removes) VALUES (
  '8.0.58', now(), ARRAY[]::text[],
  ARRAY['APNs 金鑰支援與 Supabase 函數相同的 base64 格式'], ARRAY[]::text[]
) ON CONFLICT (version) DO NOTHING;
