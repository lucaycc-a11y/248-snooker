-- v8.0.27 (test): /cam 錄影自動上傳至私人儲存空間。
INSERT INTO public.app_versions (version, released_at, adds, changes, removes) VALUES (
  '8.0.27', now() + interval '30 days',
  ARRAY['/cam 錄影完成後自動上傳（顯示進度、失敗可重試、500 MB 上限）'],
  ARRAY[]::text[],
  ARRAY[]::text[]
) ON CONFLICT (version) DO NOTHING;
