-- v8.0.46 (test): Space Pilot 介紹頁對所有訪客可見（產品仍為 Beta、暫不公開），並優化 SEO / GEO。
INSERT INTO public.app_versions (version, released_at, adds, changes, removes) VALUES (
  '8.0.46', now() + interval '30 days',
  ARRAY['Space Pilot 介紹頁對所有訪客可見並可被搜尋引擎收錄（導覽列、sitemap）','llms.txt 新增 Space Pilot 簡介，利便 AI 搜尋引用'],
  ARRAY['Space Pilot 結構化資料標示「有限供應」（Beta，只開放予少量玩家）；頁面文案維持「暫不公開」'],
  ARRAY[]::text[]
) ON CONFLICT (version) DO NOTHING;
