-- v8.0.39 (test): Space Pilot 巡場顯示 iPad 設定者及最後回應，並可遠端登出 iPad。
INSERT INTO public.app_versions (version, released_at, adds, changes, removes) VALUES (
  '8.0.39', now() + interval '30 days',
  ARRAY['Space Pilot 巡場：顯示每部 iPad 的設定者（管理員）、綁定時間、最後回應時間及是否錄影中','Space Pilot 巡場：遠端「登出 iPad」（撤銷綁定，需重新綁定）'],
  ARRAY[]::text[],
  ARRAY[]::text[]
) ON CONFLICT (version) DO NOTHING;
