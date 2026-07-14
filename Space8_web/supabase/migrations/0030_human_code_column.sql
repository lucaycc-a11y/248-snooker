-- Add human_code column to bookings table for display-friendly booking codes.
-- Run this in the Supabase SQL Editor for project wqmciwieiqvnswvspdyz.
--
-- SCOPE: Adds a nullable text column `human_code` to public.bookings. Bookings
-- created from this point forward will have the code generated at insert time
-- (via app/api/payment/create-intent/route.ts). Existing bookings with NULL
-- human_code will be backfilled by scripts/backfill-human-codes.mjs (one-off).
--
-- The human_code is a display-only fallback identifier (e.g., SPACE8-A7K2M-9)
-- derived from the booking UUID. It does NOT replace bookings.id as the primary
-- key or lookup identifier — Stripe webhook matching, door validation, and all
-- foreign keys continue to use bookings.id (UUID). The human_code is shown under
-- QR codes, in member history, and in emails as a manual-entry alternative.

alter table public.bookings
  add column if not exists human_code text;

create index if not exists bookings_human_code_idx
  on public.bookings (human_code)
  where human_code is not null;

comment on column public.bookings.human_code is
  'Display-friendly booking code (e.g., SPACE8-A7K2M-9) for manual entry fallback. Derived from bookings.id (UUID) via humanReadableCode(). Does not replace id as the primary lookup key.';
