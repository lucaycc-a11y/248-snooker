-- Migration: Replace "248-" legacy brand prefix with SPACE8-XXXXX-C human_code format
--
-- Background: The points ledger currently displays "Booking 248-XXXXXXXX" which uses
-- the old "248 Snooker Club" brand prefix. This migration updates existing records
-- to use the new SPACE8-XXXXX-C format (human_code).

-- ════════════════════════════════════════════════════════════════════
-- Update existing points_ledger entries with "Booking 248-" descriptions
-- ════════════════════════════════════════════════════════════════════

-- Update points ledger descriptions to use human_code format (SPACE8-XXXXX-C)
-- For entries that reference a booking_id, replace "Booking 248-XXXXXXXX" with "Booking SPACE8-XXXXX-C"
UPDATE public.points_ledger pl
SET note = 'Booking ' || b.human_code
FROM public.bookings b
WHERE pl.reference_id = b.id
  AND pl.type = 'booking'
  AND pl.note LIKE 'Booking 248-%'
  AND b.human_code IS NOT NULL;

-- For old bookings where human_code is NULL, leave them as-is
-- (they will display with fallback handling in the frontend)
