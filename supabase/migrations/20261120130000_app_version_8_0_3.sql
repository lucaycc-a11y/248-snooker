-- v8.0.3 (test): admin-only gate for the 8.0.2 changes (QR card look, nav
-- 我的帳戶, payment-page cleanup, member-page address, booking-email address
-- + photos). Public static address text is not gated. Releasing 8.0.3 from
-- /admin/versions also releases 8.0.2 (gate keys on 8.0.2).
INSERT INTO public.app_versions (version, released_at, adds, changes, removes) VALUES (
  '8.0.3', '2099-01-01T00:00:00+08:00',
  ARRAY['8.0.2 改動只有 admin 見到（測試版），發佈後所有人見到','/api/feature-gate 版本閘'],
  ARRAY['發佈版本時一併發佈較早嘅測試版本'],
  ARRAY[]::text[]
) ON CONFLICT (version) DO NOTHING;
