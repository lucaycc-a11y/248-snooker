-- v8.0.49 (test): 深色地圖、管理員會員卡、側門入口字樣、會員頁 Space Pilot 格。
INSERT INTO public.app_versions (version, released_at, adds, changes, removes) VALUES (
  '8.0.49', now() + interval '30 days',
  ARRAY['Footer 及會員頁地址改用深色 S8 地圖（Footer 版本不顯示樓層及單位）','付款完成頁及預約確認電郵新增「會員卡」設計（僅管理員，其他用戶維持原本 QR）','會員頁快捷格新增 Space Pilot'],
  ARRAY['預約確認電郵入口相片標題「貨車入口」改為「側門入口」','會員頁地址區由三張相片改為一張地圖（電郵維持三張相片）'],
  ARRAY['會員頁快捷格移除 Wallet（錢包仍可由積分頁進入）']
) ON CONFLICT (version) DO NOTHING;
