-- v8.0.43 (test): Space Pilot SEO 優化（標題、描述、FAQ 結構化資料）及 FAQ 文案。
INSERT INTO public.app_versions (version, released_at, adds, changes, removes) VALUES (
  '8.0.43', now() + interval '30 days',
  ARRAY['Space Pilot 頁新增 FAQ 及麵包屑結構化資料（FAQPage / BreadcrumbList）','FAQ 新增「是否收費」及「AI 戰績分析」兩題'],
  ARRAY['Space Pilot 頁標題、描述及關鍵字改寫（書面語，加入新蒲崗、自助桌球、AI 戰績分析等搜尋詞）','公開後 /spacepilot 自動加入 sitemap'],
  ARRAY[]::text[]
) ON CONFLICT (version) DO NOTHING;
