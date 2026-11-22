-- v8.0.22 (test): 修正 /join（iPad QR 加入）同 /extend（續時）登入畫面顯示 Error。
INSERT INTO public.app_versions (version, released_at, adds, changes, removes) VALUES (
  '8.0.22', now() + interval '30 days',
  ARRAY[]::text[],
  ARRAY['/join 同 /extend 補回語言環境，登入／註冊畫面不再顯示 Error'],
  ARRAY[]::text[]
) ON CONFLICT (version) DO NOTHING;
