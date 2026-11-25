INSERT INTO public.app_versions (version, released_at, adds, changes, removes) VALUES (
  '8.0.59', now(),
  ARRAY['iOS App API：會員詳情、跟進名單、封枱（新增／查看／移除）'],
  ARRAY['封枱與會員詳情的資料邏輯抽成共用程式，網頁與 iOS 完全一致'],
  ARRAY[]::text[]
) ON CONFLICT (version) DO NOTHING;
