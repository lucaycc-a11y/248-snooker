-- v8.0.23 (test): Space Pilot 對手紀錄、進步曲線、年度回顧、勝負海報；會員頁 Space Pilot 入口對非管理員變灰。
INSERT INTO public.app_versions (version, released_at, adds, changes, removes) VALUES (
  '8.0.23', now() + interval '30 days',
  ARRAY['Space Pilot 對手紀錄（Rival）','Space Pilot 進步曲線同年度回顧','Space Pilot 勝負海報（可下載分享）'],
  ARRAY['會員頁 Space Pilot 入口對非管理員變灰並顯示 BETA'],
  ARRAY[]::text[]
) ON CONFLICT (version) DO NOTHING;
