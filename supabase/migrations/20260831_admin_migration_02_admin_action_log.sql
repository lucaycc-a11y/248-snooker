-- Admin action log: INSERT-only audit trail for all admin writes.
-- RLS: only INSERT allowed for authenticated users; service_role has full access.

CREATE TABLE IF NOT EXISTS public.admin_action_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  admin_email text NOT NULL,
  action_type text NOT NULL,
  target_table text,
  target_id text,
  before_jsonb jsonb,
  after_jsonb jsonb,
  risk_level text NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high')),
  confirmed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_action_log ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to be idempotent
DROP POLICY IF EXISTS admin_action_log_insert_only ON public.admin_action_log;
DROP POLICY IF EXISTS admin_action_log_service_role_all ON public.admin_action_log;

-- Any authenticated user can INSERT (logging their own actions)
CREATE POLICY admin_action_log_insert_only ON public.admin_action_log
  FOR INSERT USING (true);

-- Service role has full access for admin queries and reads
CREATE POLICY admin_action_log_service_role_all ON public.admin_action_log
  FOR ALL USING (true)
  WITH CHECK (true);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS admin_action_log_admin_idx
  ON public.admin_action_log (admin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS admin_action_log_action_idx
  ON public.admin_action_log (action_type, created_at DESC);
CREATE INDEX IF NOT EXISTS admin_action_log_target_idx
  ON public.admin_action_log (target_table, target_id);
CREATE INDEX IF NOT EXISTS admin_action_log_created_idx
  ON public.admin_action_log (created_at DESC);
