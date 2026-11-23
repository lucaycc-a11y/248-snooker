-- v8.0.24 (test): Space Pilot 精華影片 Beta（手機鏡頭 /cam、自動截片、我的精華、Frame 影片）。
INSERT INTO public.app_versions (version, released_at, adds, changes, removes) VALUES (
  '8.0.24', now() + interval '30 days',
  ARRAY['Space Pilot 手機鏡頭（/cam）：比賽開始自動錄影，精彩時刻自動截片','我的精華：保存 30 日，可下載 Space Pilot Frame 影片（4:5 / 9:16）','影片分享 QR（/c/…），未保存 24 小時自動刪除'],
  ARRAY[]::text[], ARRAY[]::text[]
) ON CONFLICT (version) DO NOTHING;
