INSERT INTO public.app_versions (version, released_at, adds, changes, removes) VALUES (
  '8.0.62', now(), ARRAY[]::text[],
  ARRAY['付款完成頁會員卡：會員編號在窄卡片上自動換行，不再被 QR 遮住','Space Pilot 對戰紀錄：窄屏改為兩行排版，比分與日期不再直向斷行'],
  ARRAY['Space Pilot 分享海報不再顯示時間（只保留日期）']
) ON CONFLICT (version) DO NOTHING;
