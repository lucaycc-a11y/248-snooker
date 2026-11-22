-- v8.0.17 (test): /member「Space Pilot」頁籤 — 計分紀錄、私人相片；/join 支援 iPad 加入碼。
INSERT INTO public.app_versions (version, released_at, adds, changes, removes) VALUES (
  '8.0.17', now() + interval '30 days',
  ARRAY['會員中心新增「Space Pilot」頁籤：對戰紀錄、勝率同只有自己睇得到嘅相片（內測，只開放管理員）',
        '/join 支援 Space Pilot iPad 加入碼：登入或註冊後自動加入檯面'],
  ARRAY[]::text[],
  ARRAY[]::text[]
) ON CONFLICT (version) DO NOTHING;
