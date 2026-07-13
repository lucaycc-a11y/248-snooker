-- P0 fix: bookings.booking_reference does not exist in the live database,
-- even though it has been read/written by confirm_booking and
-- confirm_booking_group since migration 0004, and is selected directly by
-- app/api/booking/status/route.ts, lib/data/getMember.ts, and several admin
-- pages. Production logs show every /api/booking/status call (the confirm
-- page's poll loop) failing with:
--   "column bookings.booking_reference does not exist"
-- which 500s the confirm page (renders nothing — the reported black screen)
-- and very likely also throws inside confirm_booking/confirm_booking_group
-- when a real Stripe payment_intent.succeeded webhook tries to write it,
-- leaving otherwise-successfully-paid bookings stuck at status='pending'.
--
-- bookings predates this repo's migration history (see 0025's note — no
-- CREATE TABLE was ever committed for it), so this column was evidently
-- never actually applied despite 0004 assuming its existence. Idempotent —
-- safe to re-run.

ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS booking_reference text;

-- Backfill any existing confirmed/pending/etc. rows that predate this column,
-- using the exact same format confirm_booking generates for new rows
-- ('248-' + 8 uppercase hex chars from a fresh UUID), so old and new
-- references are visually indistinguishable.
UPDATE public.bookings
   SET booking_reference = '248-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
 WHERE booking_reference IS NULL;

-- qr_code has the exact same "read/written by confirm_booking (0008) /
-- confirm_booking_group (0012) but never CREATE'd in any tracked migration"
-- shape as booking_reference above — guard it the same way rather than wait
-- for it to surface as the next P0 once booking_reference stops masking it.
-- No backfill: qr_code's value comes from the caller-supplied human-readable
-- code at confirm time (see lib/qr/jwt.ts), not something safe to fabricate
-- here for already-confirmed rows.
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS qr_code text;
