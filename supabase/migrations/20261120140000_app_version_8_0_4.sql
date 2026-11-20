-- v8.0.4: public pages show the building-level address (no floor/unit).
-- Normal release (released_at = now): public static text cannot be admin-gated.
INSERT INTO public.app_versions (version, released_at, adds, changes, removes) VALUES (
  '8.0.4', now(),
  ARRAY[]::text[],
  ARRAY['所有公開頁面地址改為「新蒲崗大有街 32 號泰力工業中心」（頁尾、關於、如何前往、FAQ、meta、JSON-LD），不含樓層單位'],
  ARRAY[]::text[]
) ON CONFLICT (version) DO NOTHING;
