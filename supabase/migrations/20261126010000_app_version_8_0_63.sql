INSERT INTO public.app_versions (version, released_at, adds, changes, removes) VALUES (
  '8.0.63', now(),
  ARRAY['博客後台：拖放 .html／.md 文章或圖片自動匯入，並自動優化 SEO（標題、描述、H1、圖片 alt、站內連結、FAQ、CTA），附匯入報告可逐項還原','博客後台：區塊排序，可拖動調整段落、圖片、FAQ、CTA 的順序'],
  ARRAY['導覽列縮小字體與間距，縮短整條導覽列'],
  ARRAY[]::text[]
) ON CONFLICT (version) DO NOTHING;
