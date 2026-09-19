-- Add password_version to site_gate_config so that changing the password
-- atomically invalidates all previously issued bypass cookies.
-- Safe to re-run: ALTER COLUMN ... ADD IF NOT EXISTS / UPDATE ... WHERE are idempotent.

ALTER TABLE public.site_gate_config
  ADD COLUMN IF NOT EXISTS password_version integer NOT NULL DEFAULT 1;

-- Ensure the singleton row has version = 1 if it was seeded before this migration.
UPDATE public.site_gate_config
   SET password_version = 1
 WHERE id = '00000000-0000-0000-0000-000000000001'
   AND password_version IS NULL;
