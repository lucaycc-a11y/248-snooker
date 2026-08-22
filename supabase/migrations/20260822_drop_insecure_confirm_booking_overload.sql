-- Drop the old insecure confirm_booking overload that accepts caller-supplied
-- p_total_price and p_is_free parameters (security vulnerability).
--
-- Background: Migration 0008_confirm_booking_hardening.sql replaced the old
-- 5-parameter signature (uuid, text, text, integer, boolean) with a new
-- 5-parameter signature (uuid, text, text, text, text) that reads price/free
-- status from the bookings row instead of trusting the caller. However, the
-- old version apparently still exists in the database, causing ambiguous
-- function errors when the code calls confirm_booking with 5 parameters.
--
-- This migration definitively drops the old insecure overload. The current
-- codebase uses only the new secure signature from migration 0008.

-- Drop the old insecure overload if it exists
drop function if exists public.confirm_booking(uuid, text, text, integer, boolean);

-- Verify the correct signature exists (this is idempotent, just ensures it's there)
-- The correct signature from migration 0008 is:
-- confirm_booking(p_booking_id uuid, p_payment_intent_id text, p_payment_method text,
--                 p_qr_code text, p_event_id text default null)
--
-- We don't need to recreate it here since migration 0008 already did that.
-- This migration only drops the old conflicting overload.
