INSERT INTO public.app_versions (version, released_at, adds, changes, removes) VALUES (
  '8.0.64', now(),
  ARRAY['博客：文章列表可拖動排序，公開博客依此排列','博客 SEO／GEO：BlogPosting、麵包屑、FAQ 結構化資料，RSS 訂閱（/blog/feed.xml），sitemap 更新日期，llms.txt 博客資訊'],
  ARRAY[]::text[],
  ARRAY[]::text[]
) ON CONFLICT (version) DO NOTHING;
