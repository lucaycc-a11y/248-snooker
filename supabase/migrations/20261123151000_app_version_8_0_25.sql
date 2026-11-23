-- v8.0.25 (test): 精華片 AI 驗證、訓練模式、每次得分都截片。
INSERT INTO public.app_versions (version, released_at, adds, changes, removes) VALUES (
  '8.0.25', now() + interval '30 days',
  ARRAY['Space Pilot 精華片 AI 驗證：MiMo 睇片判斷有冇球入袋（只記錄，唔自動刪除）','手機鏡頭訓練模式：保存片 180 日做 AI 訓練（上限 150 段，只限管理員）'],
  ARRAY['每次得分都自動截片（每場上限 20 段、每日 120 段）'],
  ARRAY[]::text[]
) ON CONFLICT (version) DO NOTHING;
