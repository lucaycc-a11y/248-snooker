-- v8.0.5 (test): arrival guide (3 steps + photos) on the member page and in the
-- booking email. Gated with 8.0.2 (admin-only until released).
INSERT INTO public.app_versions (version, released_at, adds, changes, removes) VALUES (
  '8.0.5', '2099-01-01T00:00:00+08:00',
  ARRAY['會員頁到達指引（正門、貨車入口、SPACE8 門口三步＋相片）','確認電郵到達指引加入文字步驟'],
  ARRAY[]::text[],
  ARRAY[]::text[]
) ON CONFLICT (version) DO NOTHING;
