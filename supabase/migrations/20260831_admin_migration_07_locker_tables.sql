-- Locker management: lockers + locker_bookings.

-- ============================================================
-- 1. lockers
-- ============================================================
CREATE TABLE IF NOT EXISTS public.lockers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number integer NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'maintenance')),
  label text
);

ALTER TABLE public.lockers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lockers_service_role_all ON public.lockers;
CREATE POLICY lockers_service_role_all ON public.lockers
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 2. locker_bookings
-- ============================================================
CREATE TABLE IF NOT EXISTS public.locker_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  locker_id uuid NOT NULL REFERENCES public.lockers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.locker_bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS locker_bookings_service_role_all ON public.locker_bookings;
CREATE POLICY locker_bookings_service_role_all ON public.locker_bookings
  FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS locker_bookings_locker_idx ON public.locker_bookings (locker_id, status);
CREATE INDEX IF NOT EXISTS locker_bookings_user_idx ON public.locker_bookings (user_id, status);
CREATE INDEX IF NOT EXISTS locker_bookings_booking_idx ON public.locker_bookings (booking_id);
