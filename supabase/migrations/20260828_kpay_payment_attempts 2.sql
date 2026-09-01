-- Payment-attempt audit trail for KPay checkout creation and webhook outcomes.
-- Server-side routes/webhooks write through the service role.

CREATE TABLE IF NOT EXISTS public.payment_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  order_group_id uuid,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider = 'kpay'),
  provider_order_no text,
  status text NOT NULL CHECK (status IN ('claimed', 'pending', 'succeeded', 'failed', 'cancelled', 'expired')),
  failure_code text,
  failure_reason text,
  idempotency_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CONSTRAINT payment_attempts_idempotency_key_unique UNIQUE (idempotency_key)
);

ALTER TABLE public.payment_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY payment_attempts_select_own ON public.payment_attempts
  FOR SELECT USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS payment_attempts_booking_idx
  ON public.payment_attempts (booking_id, created_at DESC);
CREATE INDEX IF NOT EXISTS payment_attempts_active_booking_idx
  ON public.payment_attempts (booking_id)
  WHERE status IN ('claimed', 'pending');

-- A booking can have one active external-order claim at a time. Historical
-- attempts remain available for support and reconciliation.
CREATE UNIQUE INDEX IF NOT EXISTS payment_attempts_one_active_booking
  ON public.payment_attempts (booking_id)
  WHERE status IN ('claimed', 'pending');
