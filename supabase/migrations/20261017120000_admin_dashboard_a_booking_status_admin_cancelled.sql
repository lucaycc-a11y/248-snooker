-- Migration A: admin_dashboard_a_booking_status_admin_cancelled
-- The admin cancel path already writes status = 'admin_cancelled', but the CHECK
-- constraint rejects it — every admin cancel fails today. This fixes a bug.
-- Source: 01-database-guideline.md (Luca), verified against live schema 2026-10-17.

alter table public.bookings drop constraint bookings_status_check;
alter table public.bookings add constraint bookings_status_check
  check (status = any (array['pending','confirmed','cancelled','expired','payment_failed','payment_review','refunded','admin_cancelled']::text[]));
