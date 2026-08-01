-- Adds 'payment_failed' to bookings.status so a Stripe
-- payment_intent.payment_failed webhook (or a stuck pending row that never
-- reached Stripe at all) has a real terminal state instead of being left at
-- 'pending' forever. Same pattern as 0025_admin_cancelled_status.sql — the
-- constraint name isn't guaranteed since bookings predates this migration
-- history, so drop-if-exists + re-add explicitly. Idempotent — safe to re-run.

DO $$
BEGIN
  ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
  ALTER TABLE public.bookings ADD CONSTRAINT bookings_status_check
    CHECK (status IN ('pending', 'confirmed', 'refunded', 'admin_cancelled', 'payment_failed'));
END $$;
