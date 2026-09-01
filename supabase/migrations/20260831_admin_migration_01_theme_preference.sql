-- Admin dashboard theme preference (dark/light/system).
-- Idempotent: uses IF NOT EXISTS for the column and check constraint.

DO $$
BEGIN
  -- Add column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'admin_users' AND column_name = 'theme_preference'
  ) THEN
    ALTER TABLE public.admin_users ADD COLUMN theme_preference text DEFAULT 'dark';
  END IF;

  -- Drop existing check constraint if present, then re-add
  ALTER TABLE public.admin_users DROP CONSTRAINT IF EXISTS admin_users_theme_preference_check;
  ALTER TABLE public.admin_users ADD CONSTRAINT admin_users_theme_preference_check
    CHECK (theme_preference IN ('dark', 'light', 'system'));
END $$;
