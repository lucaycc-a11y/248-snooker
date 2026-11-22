-- v8.0.18 (test): Space Pilot 巡場後台、會員統計。
INSERT INTO public.app_versions (version, released_at, adds, changes, removes) VALUES (
  '8.0.18', now() + interval '30 days',
  ARRAY['後台新增「Space Pilot 巡場」：兩間房實時比分與剩餘時間，可遠端結束比賽、響警報、加 10 分鐘（只加 iPad 計時）',
        '會員 Space Pilot 頁籤新增累計勝率、最長連勝、最常對手',
        '新增 /extend 續時付款入口同 /p 相片分享頁'],
  ARRAY[]::text[],
  ARRAY[]::text[]
) ON CONFLICT (version) DO NOTHING;
