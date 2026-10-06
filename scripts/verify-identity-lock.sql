-- Part B1 verification — run in the Supabase SQL editor AFTER the migration and
-- AFTER creating a THROWAWAY test account (never a real member).
-- Replace the three placeholders, then run each block and paste the output.
--   :test_user   uuid of the throwaway account
--   :admin_user  your admin auth user id (admin_users.user_id)
--   :other_phone a phone that already belongs to some other account

-- 0. Objects exist
select tgname, tgrelid::regclass from pg_trigger
 where tgname in ('guard_users_identity_columns','guard_auth_users_identity','guard_auth_identities_link');
select (select count(*) from vault.decrypted_secrets where name = 'identity_hash_pepper') as pepper_present;
select has_function_privilege('authenticated', 'public.admin_change_user_identity(uuid,text,text,text,uuid,boolean)', 'execute') as authenticated_can_exec,
       has_function_privilege('service_role',  'public.admin_change_user_identity(uuid,text,text,text,uuid,boolean)', 'execute') as service_can_exec,
       has_column_privilege('authenticated', 'public.users', 'phone', 'update') as auth_can_update_phone,
       has_column_privilege('authenticated', 'public.users', 'email', 'update') as auth_can_update_email,
       has_column_privilege('authenticated', 'public.users', 'display_name', 'update') as auth_can_update_name;

-- 1. BEFORE snapshot (keep this output)
select u.id, u.phone, u.email, u.member_code, u.points, u.credits, u.needs_manual_phone_reverify,
       a.phone as auth_phone, a.email as auth_email, a.phone_confirmed_at,
       (select count(*) from public.bookings b where b.user_id = u.id) as bookings,
       (select count(*) from auth.sessions s where s.user_id = u.id) as sessions
  from public.users u join auth.users a on a.id = u.id where u.id = ':test_user';

-- 2. Direct UPDATE (even as superuser) must fail with identity_change_forbidden.
--    Wrapped so nothing sticks even if a guard were missing. Run each separately.
begin; update public.users set phone = '+85290000001' where id = ':test_user'; rollback;
begin; update auth.users set email = 'blocked-test@example.com' where id = ':test_user'; rollback;
begin; update auth.users set phone_change = '85290000001' where id = ':test_user'; rollback;

-- 3. Duplicate rejected → code in_use
select public.admin_change_user_identity(':test_user', ':other_phone', null, 'verify duplicate', ':admin_user');

-- 4. Not an admin → admin_not_active   (test user's own id as "admin")
select public.admin_change_user_identity(':test_user', '+85290000002', null, 'verify non-admin', ':test_user');

-- 5. Success path is done through the API route (sends the emails) — see
--    scripts/verify-identity-lock.client.md step 3. Then:

-- 6. AFTER snapshot: compare with step 1 (member_code/points/credits/bookings equal,
--    sessions = 0, auth_phone = phone without '+', phone_confirmed_at null)
-- (re-run block 1)

-- 7. History + audit
select kind, old_hash is not null as has_old_hash, new_hash is not null as has_new_hash,
       override_cooldown, changed_at from public.identity_change_history
 where user_id = ':test_user' order by changed_at desc;
select action, before_value, after_value, created_at from public.audit_log
 where target_id = ':test_user' order by created_at desc limit 3;

-- 8. Cooldown → code cooldown
select public.admin_change_user_identity(':test_user', '+85290000003', null, 'verify cooldown', ':admin_user');

-- 9. Old phone now counts as used → code previously_used (use the ORIGINAL phone of the test user, on any account)
-- select public.admin_change_user_identity(':test_user', '<original phone>', null, 'verify reuse', ':admin_user', true);

-- 10. Notification log
select type, status, error_message, sent_at from public.notification_log
 where user_id = ':test_user' and type like 'identity_changed_%' order by sent_at desc;
