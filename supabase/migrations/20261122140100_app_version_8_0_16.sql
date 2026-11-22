-- v8.0.16: /admin/space8 — SPACE8 費用帳（開支、Claim 扣減、匯出 PDF）。
INSERT INTO public.app_versions (version, released_at, adds, changes, removes) VALUES (
  '8.0.16', now(),
  ARRAY['後台新增「SPACE8 費用」頁：開支總覽、各人先墊付款、Claim 記錄及未 Claim 餘額，可匯出 PDF'],
  ARRAY[]::text[],
  ARRAY[]::text[]
) ON CONFLICT (version) DO NOTHING;
