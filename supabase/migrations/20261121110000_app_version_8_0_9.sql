-- v8.0.9 (test): Christmas preview tweaks — hero keeps original wording with Christmas colours,
-- Christmas colours on pricing, softer snow. Future released_at = admin-only test version.
INSERT INTO public.app_versions (version, released_at, adds, changes, removes) VALUES (
  '8.0.9', now() + interval '30 days',
  ARRAY[]::text[],
  ARRAY['聖誕預覽：首頁標題保留原字句、改為聖誕漸變色；價目頁改為聖誕紅綠色；飄雪更細更少'],
  ARRAY[]::text[]
) ON CONFLICT (version) DO NOTHING;
