-- v8.0.40 (test): Space Pilot QR 加入可只用 Email（略過手機），預約仍須手機 OTP。
INSERT INTO public.app_versions (version, released_at, adds, changes, removes) VALUES (
  '8.0.40', now() + interval '30 days',
  ARRAY['Space Pilot QR 加入：Email 登入後可「略過手機」，先使用會員頁及 Space Pilot','預約前提示須完成手機 OTP 驗證（會員頁橫額及預約登入頁說明）'],
  ARRAY['新增帳戶狀態 email_only：可用會員頁，但預約及付款仍須完整資料；歡迎禮於完成手機驗證後才發放'],
  ARRAY[]::text[]
) ON CONFLICT (version) DO NOTHING;
