-- v8.0.38 (test): 會員可隱藏個人對戰紀錄；管理員可作廢對戰。
INSERT INTO public.app_versions (version, released_at, adds, changes, removes) VALUES (
  '8.0.38', now() + interval '30 days',
  ARRAY['會員 Space Pilot：可將對戰從「自己的紀錄」隱藏（不影響對手，可還原）','管理員可作廢對戰（從所有人的紀錄、統計及輪流賽移除）'],
  ARRAY['統計、年度分析、輪流賽及 AI 分析不再計入已隱藏／已作廢的對戰','分頁列背景更不透明'],
  ARRAY[]::text[]
) ON CONFLICT (version) DO NOTHING;
