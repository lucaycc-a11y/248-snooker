-- Per-admin dashboard widget layout configuration.

CREATE TABLE IF NOT EXISTS public.admin_dashboard_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL UNIQUE,
  layout jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_dashboard_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_dashboard_config_service_role_all ON public.admin_dashboard_config;
CREATE POLICY admin_dashboard_config_service_role_all ON public.admin_dashboard_config
  FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS admin_dashboard_config_admin_idx ON public.admin_dashboard_config (admin_id);
