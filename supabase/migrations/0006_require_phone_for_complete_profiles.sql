-- 248 Snooker — require WhatsApp-contactable phone before profile completion.
--
-- IMPORTANT production pre-check before applying this migration:
--
--   select count(*)
--   from public.users
--   where profile_complete = true
--     and phone is null;
--
-- If the count is non-zero, decide with Luca whether to backfill phone manually
-- or reset those legacy users to profile_complete = false so they complete the
-- phone step on their next login. Do not apply this constraint until the count
-- is zero, because PostgreSQL validates CHECK constraints against existing rows.

alter table public.users
  add constraint users_phone_required_if_complete
  check (profile_complete is not true or phone is not null);
