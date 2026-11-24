-- v8.0.45 (test): Space Pilot 頁維持僅管理員可見（暫不公開），撤回 8.0.44 的公開設定。
INSERT INTO public.app_versions (version, released_at, adds, changes, removes) VALUES (
  '8.0.45', now() + interval '30 days',
  ARRAY[]::text[],
  ARRAY['Space Pilot 頁維持僅管理員可見（暫不公開）；撤回 8.0.44 的公開設定，常見問題恢復「暫不公開」說明'],
  ARRAY[]::text[]
) ON CONFLICT (version) DO NOTHING;
