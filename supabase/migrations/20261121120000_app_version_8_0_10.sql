-- v8.0.10 (test): Christmas preview — booking/payment pages: no falling snow, snow caps on main action buttons.
INSERT INTO public.app_versions (version, released_at, adds, changes, removes) VALUES (
  '8.0.10', now() + interval '30 days',
  ARRAY[]::text[],
  ARRAY['聖誕預覽：預訂／付款頁不再飄雪，只在主要按鈕加上積雪'],
  ARRAY[]::text[]
) ON CONFLICT (version) DO NOTHING;
