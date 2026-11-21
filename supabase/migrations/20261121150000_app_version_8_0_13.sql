-- v8.0.13: FAQ — private restroom.
INSERT INTO public.app_versions (version, released_at, adds, changes, removes) VALUES (
  '8.0.13', now(),
  ARRAY['FAQ：SPACE8 有冇廁所？（獨立廁所）'],
  ARRAY[]::text[],
  ARRAY[]::text[]
) ON CONFLICT (version) DO NOTHING;
