INSERT INTO public.app_versions (version, released_at, adds, changes, removes) VALUES (
  '8.0.57', now(),
  ARRAY['iOS App API：會員列表、營業額（今日／本月）隨 overview 回傳','預約列表分頁（offset／nextOffset）'],
  ARRAY['新預約推送同時讀取 admin_device_tokens，現有 App 無需改動'],
  ARRAY[]::text[]
) ON CONFLICT (version) DO NOTHING;
