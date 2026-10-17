-- Migration B: admin_dashboard_b_cancellation_log_credit
-- 'credit' is the compensation type for cancel-with-Credit, but the CHECK rejects it.
-- Source: 01-database-guideline.md (Luca), verified against live schema 2026-10-17.

alter table public.cancellation_log drop constraint cancellation_log_compensation_type_check;
alter table public.cancellation_log add constraint cancellation_log_compensation_type_check
  check (compensation_type = any (array['none','points','refund','credit']::text[]));
