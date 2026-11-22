-- v8.0.21 (test): 續時預訂指引（iPad QR → /extend → /book 付款頁）。
INSERT INTO public.app_versions (version, released_at, adds, changes, removes) VALUES (
  '8.0.21', now() + interval '30 days',
  ARRAY['/book 付款頁新增「續時預訂指引」卡（經 iPad QR 續時時顯示）'],
  ARRAY['續時時隱藏「訂唔訂多個鐘」提示，改顯示續時指引'],
  ARRAY[]::text[]
) ON CONFLICT (version) DO NOTHING;
