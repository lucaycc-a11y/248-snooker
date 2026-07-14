-- 248 Snooker — Door Lock system, slice 1: NFC card registration.
-- Run this in the Supabase SQL Editor for project wqmciwieiqvnswvspdyz.
-- Safe to re-run: every statement is idempotent, except the ALTER
-- PUBLICATION at the bottom which is wrapped in a DO block to tolerate
-- being re-run.

CREATE TABLE IF NOT EXISTS public.staff_nfc_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uid text NOT NULL UNIQUE,
  label text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  created_by uuid
);

ALTER TABLE public.staff_nfc_cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_nfc_cards_service_role_all" ON public.staff_nfc_cards;
CREATE POLICY "staff_nfc_cards_service_role_all"
  ON public.staff_nfc_cards
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS public.door_card_registration_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','scanned','confirmed','cancelled','expired')),
  uid text,
  requested_by uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '5 minutes',
  confirmed_at timestamptz
);

ALTER TABLE public.door_card_registration_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "door_card_registration_requests_service_role_all" ON public.door_card_registration_requests;
CREATE POLICY "door_card_registration_requests_service_role_all"
  ON public.door_card_registration_requests
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Admin browser client subscribes to Realtime as `authenticated` (never
-- `service_role`), and postgres_changes delivery is enforced against the
-- subscribing connection's role — without this, the admin UI would never
-- receive scanned/confirmed updates while waiting for the ESP32 tap.
DROP POLICY IF EXISTS "door_card_registration_requests_select_own" ON public.door_card_registration_requests;
CREATE POLICY "door_card_registration_requests_select_own"
  ON public.door_card_registration_requests
  FOR SELECT
  TO authenticated
  USING (auth.uid() = requested_by);

-- Not idempotent — throws duplicate_object if already a publication member.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.door_card_registration_requests;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
