INSERT INTO public.app_versions (version, released_at, adds, changes, removes) VALUES (
  '8.0.70', now(),
  ARRAY[]::text[],
  ARRAY['修正長期失敗的自動測試：robots 測試改為以環境變數判斷、停用的測試價測試、預約成功頁會員按鈕測試，使 main 的 CI 回復綠燈（不影響網站功能）'],
  ARRAY[]::text[]
) ON CONFLICT (version) DO NOTHING;
