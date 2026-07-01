-- 248 Snooker — require WhatsApp-contactable phone before profile completion.
-- Safe to re-run: the constraint add is guarded against duplicate_object, so this
-- migration is idempotent across a fresh DB and one where the constraint already
-- exists (it was applied directly to production during an earlier debug session,
-- which does NOT register in supabase_migrations — so `supabase db push` will try
-- to run this file; without the guard it would fail on `constraint already exists`
-- and abort the whole migration chain).
--
-- IMPORTANT production pre-check before FIRST applying this to any environment
-- where the constraint does not yet exist:
--
--   select count(*)
--   from public.users
--   where profile_complete = true
--     and phone is null;
--
-- If the count is non-zero, decide with Luca whether to backfill phone manually
-- or reset those legacy users to profile_complete = false so they complete the
-- phone step on their next login. PostgreSQL validates CHECK constraints against
-- existing rows, so a non-zero count makes the ADD below raise check_violation.
-- The guard deliberately only swallows duplicate_object (already-applied), NOT
-- check_violation — a fresh environment with dirty data must still fail loudly.

do $$
begin
  alter table public.users
    add constraint users_phone_required_if_complete
    check (profile_complete is not true or phone is not null);
exception
  when duplicate_object then
    raise notice 'constraint users_phone_required_if_complete already exists, skipping';
end $$;
