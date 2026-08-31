-- Admin flag for accounts whose migrated phones need manual re-verification.
-- Do NOT auto-pick one phone as "correct" — admin decides which phone wins.
alter table public.users
  add column if not exists needs_manual_phone_reverify boolean
  not null default false;
