-- v8.0.32 (test): 法律文件分頁整理；Space Pilot 聲明新增客戶支援及不設退款條款。
INSERT INTO public.app_versions (version, released_at, adds, changes, removes) VALUES (
  '8.0.32', now() + interval '30 days',
  ARRAY['Space Pilot 聲明新增「服務性質、客戶支援及退款」條款（有問題可聯絡客戶支援，不設退款）','法律文件分頁新增 Cookie 政策'],
  ARRAY['法律文件分頁按類別重新排序，Space Pilot 分頁改為短名稱'],
  ARRAY[]::text[]
) ON CONFLICT (version) DO NOTHING;
