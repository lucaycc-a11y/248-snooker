-- v8.0.11 (test): Christmas preview — falling snow now sits behind cards and page UI.
INSERT INTO public.app_versions (version, released_at, adds, changes, removes) VALUES (
  '8.0.11', now() + interval '30 days',
  ARRAY[]::text[],
  ARRAY['聖誕預覽：飄雪改為置於卡片及介面下層'],
  ARRAY[]::text[]
) ON CONFLICT (version) DO NOTHING;
