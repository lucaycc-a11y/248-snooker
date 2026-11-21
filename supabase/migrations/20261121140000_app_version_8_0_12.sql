-- v8.0.12 (test): mobile menu account item also shows 我的帳戶 (admin-only gate with 8.0.2).
INSERT INTO public.app_versions (version, released_at, adds, changes, removes) VALUES (
  '8.0.12', '2099-01-01T00:00:00+08:00',
  ARRAY[]::text[],
  ARRAY['手機選單底部帶頭像嘅「會員」改為「我的帳戶」'],
  ARRAY[]::text[]
) ON CONFLICT (version) DO NOTHING;
