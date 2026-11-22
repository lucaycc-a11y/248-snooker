-- v8.0.19 (test): Space Pilot 入口加到會員首頁（/member/pilot）。
INSERT INTO public.app_versions (version, released_at, adds, changes, removes) VALUES (
  '8.0.19', now() + interval '30 days',
  ARRAY['會員首頁新增「Space Pilot」入口（/member/pilot）：計分紀錄、勝率、相片（內測）'],
  ARRAY[]::text[],
  ARRAY[]::text[]
) ON CONFLICT (version) DO NOTHING;
