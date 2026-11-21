-- v8.0.15: member page — venue address + arrival guide moved to the very bottom on mobile/tablet.
INSERT INTO public.app_versions (version, released_at, adds, changes, removes) VALUES (
  '8.0.15', now(),
  ARRAY[]::text[],
  ARRAY['會員頁場地地址及到達指引喺手機版移到最底（電腦版仍喺會員卡下面）'],
  ARRAY[]::text[]
) ON CONFLICT (version) DO NOTHING;
