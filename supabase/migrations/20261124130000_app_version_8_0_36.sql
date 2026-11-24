-- v8.0.36 (test): 會員 Space Pilot 頁新增 AI 戰績分析。
INSERT INTO public.app_versions (version, released_at, adds, changes, removes) VALUES (
  '8.0.36', now() + interval '30 days',
  ARRAY['會員 Space Pilot 頁 AI 戰績分析：根據對戰紀錄生成總結及最多三項建議（至少 3 場；不傳送對手姓名）'],
  ARRAY[]::text[],
  ARRAY[]::text[]
) ON CONFLICT (version) DO NOTHING;
