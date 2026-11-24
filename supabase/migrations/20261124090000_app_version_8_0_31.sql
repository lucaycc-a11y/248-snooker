-- v8.0.31 (test): Space Pilot 頁動畫、主頁 Pricing/會員卡動畫、SEO 與「獨家・會員免費」字樣。
INSERT INTO public.app_versions (version, released_at, adds, changes, removes) VALUES (
  '8.0.31', now() + interval '30 days',
  ARRAY['Space Pilot 頁 SEO（標題、描述、OG、結構化資料；公開前維持 noindex）','「Space8 獨家・會員免費使用」字樣','主頁 Pricing 區動畫（標題淡入、卡片上升、價錢數字滾動）','Space Pilot 首頁 iPad 上升並轉入牆身場景'],
  ARRAY['主頁會員卡寬度一致','移除 Space Pilot 首頁副標題「掛在牆上的 iPad…」'],
  ARRAY[]::text[]
) ON CONFLICT (version) DO NOTHING;
