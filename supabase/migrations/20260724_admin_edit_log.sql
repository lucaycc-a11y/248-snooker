-- 248 Snooker Admin App — admin_edit_log audit table
-- Creates immutable audit trail for all critical admin operations
-- Run in Supabase SQL Editor after the admin_users/is_active_admin migration

-- 1. Create admin_edit_log table
CREATE TABLE IF NOT EXISTS public.admin_edit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL REFERENCES public.admin_users(user_id),
  table_name text NOT NULL,
  record_id uuid,
  field_name text,
  old_value text,
  new_value text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE public.admin_edit_log ENABLE ROW LEVEL SECURITY;

-- 3. Admin read-only policy (can read, cannot update/delete for immutability)
DROP POLICY IF EXISTS "admin_edit_log_admin_select" ON public.admin_edit_log;
CREATE POLICY "admin_edit_log_admin_select"
  ON public.admin_edit_log
  FOR SELECT
  USING (public.is_active_admin());

-- 4. Admin insert-only policy (can log new entries, cannot modify existing)
DROP POLICY IF EXISTS "admin_edit_log_admin_insert" ON public.admin_edit_log;
CREATE POLICY "admin_edit_log_admin_insert"
  ON public.admin_edit_log
  FOR INSERT
  WITH CHECK (public.is_active_admin());

-- 5. NO UPDATE or DELETE policies — audit records are immutable

-- 6. Index for performance
CREATE INDEX IF NOT EXISTS admin_edit_log_admin_user_id_idx ON public.admin_edit_log(admin_user_id);
CREATE INDEX IF NOT EXISTS admin_edit_log_created_at_idx ON public.admin_edit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS admin_edit_log_table_record_idx ON public.admin_edit_log(table_name, record_id);

-- Verification query
-- SELECT * FROM admin_edit_log ORDER BY created_at DESC LIMIT 10;
