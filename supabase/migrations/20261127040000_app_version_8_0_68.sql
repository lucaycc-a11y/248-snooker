INSERT INTO public.app_versions (version, released_at, adds, changes, removes) VALUES (
  '8.0.68', now(),
  ARRAY['iOS 後台 API：/overview 一次過提供過去 7 日營業額走勢，與今日數字同一個請求、同一個來源'],
  ARRAY['iOS 概覽頁今日數字與 7 日圖表不再出現不一致'],
  ARRAY[]::text[]
) ON CONFLICT (version) DO NOTHING;
