-- v8.0.37 (test): 會員 Space Pilot 頁分頁整理。
INSERT INTO public.app_versions (version, released_at, adds, changes, removes) VALUES (
  '8.0.37', now() + interval '30 days',
  ARRAY[]::text[],
  ARRAY['會員 Space Pilot 頁改為「總覽／對戰／精華與相片」三個分頁，減少長捲動；分頁列捲動時固定頂部'],
  ARRAY[]::text[]
) ON CONFLICT (version) DO NOTHING;
