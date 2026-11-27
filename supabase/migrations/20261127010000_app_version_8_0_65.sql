INSERT INTO public.app_versions (version, released_at, adds, changes, removes) VALUES (
  '8.0.65', now(),
  ARRAY['博客前台：全新設計，Good Times 標題、搜尋、分類篩選與數量、精選文章、載入更多、排序切換、RSS 入口；文章頁加入閱讀進度條與目錄','博客後台：文章列表加入統計、搜尋、狀態與語言篩選、封面縮圖、瀏覽數、SEO 提示；編輯器改為內容＋發佈側欄雙欄版面'],
  ARRAY['博客前台移除沒有實際功能的訂閱表單'],
  ARRAY[]::text[]
) ON CONFLICT (version) DO NOTHING;
