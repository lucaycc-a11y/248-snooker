-- v8.0.14: FAQ — food policy (avoid strong-smelling / messy foods).
INSERT INTO public.app_versions (version, released_at, adds, changes, removes) VALUES (
  '8.0.14', now(),
  ARRAY['FAQ：可以喺 SPACE8 食嘢嗎？（避免氣味濃烈或易散落碎屑嘅食物）'],
  ARRAY[]::text[],
  ARRAY[]::text[]
) ON CONFLICT (version) DO NOTHING;
