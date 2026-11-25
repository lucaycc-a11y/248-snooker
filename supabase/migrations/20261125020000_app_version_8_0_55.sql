-- v8.0.55: iOS 管理員 API 及 Agent 設定指南。
INSERT INTO public.app_versions (version, released_at, adds, changes, removes) VALUES (
  '8.0.55', now(),
  ARRAY['iOS 管理員 API：/api/admin/app/me（檢查是否管理員）、/api/admin/app/overview（今日預約、門禁狀態、版本）','Bearer token 管理員驗證（lib/admin/bearer-auth.ts）','docs/ios-admin-api.md 及 AGENT_SETUP.md'],
  ARRAY[]::text[],
  ARRAY[]::text[]
) ON CONFLICT (version) DO NOTHING;
