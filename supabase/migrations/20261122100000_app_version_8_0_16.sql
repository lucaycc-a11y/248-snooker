-- v8.0.16: SEO — public hourly rates (from config, no hardcoding): /pricing page,
-- venue-page pricing block, price FAQ (/faq + FAQPage JSON-LD), "from HK$X per hour"
-- in home/venue meta descriptions, sitemap entry.
INSERT INTO public.app_versions (version, released_at, adds, changes, removes) VALUES (
  '8.0.16', now(),
  ARRAY['/pricing 收費頁（Offer + FAQPage 結構化資料，價錢由 config 讀取）','場地頁收費區塊','FAQ 頁「每小時收費係幾多」','首頁及場地頁 meta 描述加「每小時 HK$X 起」','sitemap 加 /pricing'],
  ARRAY[]::text[],
  ARRAY[]::text[]
) ON CONFLICT (version) DO NOTHING;
