INSERT INTO public.app_versions (version, released_at, adds, changes, removes) VALUES (
  '8.0.69', now(),
  ARRAY['iOS 後台 API：/overview 同一個請求提供今日預約列表、最近預約、營業額同 7 日走勢，概覽頁各項數據來自同一刻'],
  ARRAY['iOS 預約列表與概覽共用同一個預約載入邏輯，隱藏帳戶與測試單規則一致'],
  ARRAY[]::text[]
) ON CONFLICT (version) DO NOTHING;
