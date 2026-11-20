-- v8.0.8 (test): admin-only Christmas theme preview. Future released_at = admin-only test version.
INSERT INTO public.app_versions (version, released_at, adds, changes, removes) VALUES (
  '8.0.8', now() + interval '30 days',
  ARRAY['後台「聖誕預覽」頁：揀選可見聖誕主題（飄雪＋聖誕字句）的管理員；其他人完全看不到'],
  ARRAY[]::text[],
  ARRAY[]::text[]
) ON CONFLICT (version) DO NOTHING;
