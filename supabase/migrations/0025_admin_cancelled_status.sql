-- Widens bookings.status to allow 'admin_cancelled' (Part 3's staff-initiated
-- soft-cancel, distinct from user-initiated 'refunded'). The bookings table
-- itself predates this repo's migration history (no CREATE TABLE was ever
-- committed for it — see 0011's placeholder note), so the exact constraint
-- name isn't guaranteed; this drops the default Postgres-generated name if
-- present and (re)adds it explicitly. Idempotent — safe to re-run.

DO $$
BEGIN
  ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
  ALTER TABLE public.bookings ADD CONSTRAINT bookings_status_check
    CHECK (status IN ('pending', 'confirmed', 'refunded', 'admin_cancelled'));
END $$;
