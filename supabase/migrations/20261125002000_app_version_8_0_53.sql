-- v8.0.53 (test): Space Pilot 頁新增「多種賽制」（中八、九球、團隊、輪流賽）。
INSERT INTO public.app_versions (version, released_at, adds, changes, removes) VALUES (
  '8.0.53', now() + interval '30 days',
  ARRAY['Space Pilot 頁新增「多種賽制」功能卡及常見問題（中八、九球局數制／搶分制、團隊、輪流賽）'],
  ARRAY['Space Pilot 頁搜尋描述及 llms.txt 加入九球計分'],
  ARRAY[]::text[]
) ON CONFLICT (version) DO NOTHING;
