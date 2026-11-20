-- v8.0.6: FAQ "how do I find the floor/unit" (public; no unit number shown).
INSERT INTO public.app_versions (version, released_at, adds, changes, removes) VALUES (
  '8.0.6', now(),
  ARRAY['FAQ：在大廈入面點樣搵到 SPACE8（樓層及單位）'],
  ARRAY[]::text[],
  ARRAY[]::text[]
) ON CONFLICT (version) DO NOTHING;
