-- v8.0.54: 清理已發佈功能的測試開關及舊程式碼，減少頁面載入時的額外請求。
INSERT INTO public.app_versions (version, released_at, adds, changes, removes) VALUES (
  '8.0.54', now(),
  ARRAY[]::text[],
  ARRAY['8.0.2 起的功能（我的帳戶、會員頁地址、確認電郵地址及到達相片、付款頁簡化、會員卡式 QR）改為所有用戶固定使用，不再逐頁查詢版本開關','Footer 地圖改為靜態圖片，不再載入地圖程式庫'],
  ARRAY['移除測試版本開關 API（/api/feature-gate）及客戶端查詢','刪除舊版元件及備份檔（_deprecated、*.bak、舊 Footer 地圖）']
) ON CONFLICT (version) DO NOTHING;
