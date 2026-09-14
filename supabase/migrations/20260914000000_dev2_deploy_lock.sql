-- Dev2 Panel: Add deploy_lock to config table
-- Prevents concurrent deploy operations

ALTER TABLE public.config
ADD COLUMN IF NOT EXISTS deploy_lock boolean DEFAULT false;

COMMENT ON COLUMN public.config.deploy_lock IS
  'Deploy operation lock - prevents concurrent push/maintenance operations';
