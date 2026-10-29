-- Per-admin test mode: while on, every checkout this admin makes is flagged
-- is_test (booking + slot) server-side, so it is hidden from public booking
-- availability and excluded from revenue/stats. Pricing is never affected.
alter table public.admin_users
  add column if not exists test_mode boolean not null default false,
  add column if not exists test_mode_set_by text,
  add column if not exists test_mode_set_at timestamptz;
