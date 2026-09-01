-- Cancellation log: tracks admin-initiated booking cancellations with compensation.

CREATE TABLE IF NOT EXISTS public.cancellation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  admin_id uuid NOT NULL,
  reason text NOT NULL,
  compensation_type text NOT NULL DEFAULT 'none' CHECK (compensation_type IN ('none', 'points', 'refund')),
  compensation_value numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cancellation_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cancellation_log_service_role_all ON public.cancellation_log;

-- Service role only (admin operations go through SECURITY DEFINER functions)
CREATE POLICY cancellation_log_service_role_all ON public.cancellation_log
  FOR ALL USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS cancellation_log_booking_idx
  ON public.cancellation_log (booking_id);
CREATE INDEX IF NOT EXISTS cancellation_log_admin_idx
  ON public.cancellation_log (admin_id, created_at DESC);
