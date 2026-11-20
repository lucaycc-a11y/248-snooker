-- v8.0.2 (test): public address hidden (area only), unified member-card QR,
-- nav 我的帳戶, booking email address + arrival photos, payment page cleanup.
-- Future released_at => admin sees "v8.0.2（test）"; release to everyone from
-- /admin/versions (發佈給所有人), which sets released_at = now().
INSERT INTO public.app_versions (version, released_at, adds, changes, removes) VALUES (
  '8.0.2', '2099-01-01T00:00:00+08:00',
  ARRAY['確認電郵及會員中心顯示完整地址（3 樓 05 室）','確認電郵加入到達指引相片','Admin 版本頁「發佈給所有人」按鈕'],
  ARRAY['公開頁面地址改為「新蒲崗，鄰近鑽石山、啟德」（頁尾、關於、如何前往、meta、JSON-LD）','場地頁只顯示大廈地址（不含樓層單位）','所有會員碼 QR 統一為會員卡款式','導覽「會員」改為「我的帳戶」'],
  ARRAY['付款成功頁「加入日曆」「分享」按鈕']
) ON CONFLICT (version) DO NOTHING;
