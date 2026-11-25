INSERT INTO public.app_versions (version, released_at, adds, changes, removes) VALUES (
  '8.0.56', now(),
  ARRAY['iOS App API：隱藏帳戶（與網頁後台同一套規則及資料）'],
  ARRAY['iOS 預約列表、搜尋及新預約推送改為與網頁相同，排除隱藏帳戶及測試預約'],
  ARRAY[]::text[]
) ON CONFLICT (version) DO NOTHING;
