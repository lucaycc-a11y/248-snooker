-- v8.0.7: arrival guide copy — drop the wet-floor warning from step 2.
INSERT INTO public.app_versions (version, released_at, adds, changes, removes) VALUES (
  '8.0.7', now(),
  ARRAY[]::text[],
  ARRAY['到達指引第 2 步改為「如有需要，可由側面入口進入。」（會員頁、確認電郵、FAQ）'],
  ARRAY[]::text[]
) ON CONFLICT (version) DO NOTHING;
