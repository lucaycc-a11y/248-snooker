-- Dev2 Panel: Add reason field to site_gate_config
-- Allows content swapping between "prelaunch" and "maintenance" contexts

ALTER TABLE public.site_gate_config
ADD COLUMN IF NOT EXISTS reason text DEFAULT 'prelaunch' CHECK (reason IN ('prelaunch', 'maintenance'));

COMMENT ON COLUMN public.site_gate_config.reason IS
  'Why the gate is enabled: prelaunch (pre-launch coming soon) or maintenance (post-push internal review)';
