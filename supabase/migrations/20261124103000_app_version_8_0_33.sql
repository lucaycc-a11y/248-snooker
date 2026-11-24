-- v8.0.33 (test): 法律文件頁新增搜尋。
INSERT INTO public.app_versions (version, released_at, adds, changes, removes) VALUES (
  '8.0.33', now() + interval '30 days',
  ARRAY['法律文件頁搜尋：可跨所有條款搜尋關鍵字，點擊結果直達對應條文'],
  ARRAY[]::text[],
  ARRAY[]::text[]
) ON CONFLICT (version) DO NOTHING;
