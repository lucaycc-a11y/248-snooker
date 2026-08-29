-- Registration state contract: email-first ordering + a durable "complete means
-- verified" invariant on public.users.
--
-- Context. Registration is being reordered so the email is proven first and the
-- phone second, because a brand-new account is only ever bootstrapped from a
-- verified email address: an unknown phone number may log in to an existing
-- account but must never create one. This migration widens the signup status
-- ladder, records which method produced the attempt, and makes
-- "profile_complete = true" mean "both contacts actually verified".
--
-- Self-bootstrapping. Section 0 creates the auth_signup_attempts table and the
-- public.users identity columns/indexes this migration depends on, because the
-- live project (wqmciwieiqvnswvspdyz) was found not to have them. Every statement
-- is idempotent, so applying 20260828_auth_flow_redesign.sql before or after this
-- file is harmless. 20260828 remains the canonical source for
-- contact_change_requests and apply_verified_contact_change, which this migration
-- does not need — apply it before the contact-change work lands.
--
-- Run in the Supabase SQL Editor. Read the backfill note in section 3 first.

-- =====================================================================
-- 0. Prerequisites (idempotent; no-ops if 20260828 already ran)
-- =====================================================================

-- Identity uniqueness. Confirmed clean on 2026-08-29: no duplicate lower(email)
-- and no duplicate phone rows in public.users.
create unique index if not exists users_email_lower_uniq
  on public.users (lower(email)) where email is not null;

create unique index if not exists users_phone_uniq
  on public.users (phone) where phone is not null;

do $$
begin
  alter table public.users add column email_verified_at timestamptz;
exception
  when duplicate_column then
    raise notice 'users.email_verified_at already exists, skipping';
end $$;

do $$
begin
  alter table public.users add column phone_verified_at timestamptz;
exception
  when duplicate_column then
    raise notice 'users.phone_verified_at already exists, skipping';
end $$;

-- Pending registrations. Created here with its final shape; the alters in
-- sections 1 and 2 then become no-ops on a fresh project and upgrades on an
-- existing one.
create table if not exists public.auth_signup_attempts (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  email text not null,
  phone text not null,
  method text not null default 'email',
  sms_message_id text,
  email_verified_at timestamptz,
  phone_verified_at timestamptz,
  email_code_hash text,
  email_code_expires_at timestamptz,
  email_attempts integer not null default 0,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  completed_at timestamptz
);

-- Holds live verification material, so it is service-role only. Explicit
-- per-operation policies document that posture and prevent accidental exposure if
-- a client role is ever granted table privileges.
alter table public.auth_signup_attempts enable row level security;

drop policy if exists auth_signup_attempts_select_service on public.auth_signup_attempts;
create policy auth_signup_attempts_select_service on public.auth_signup_attempts
  for select using (auth.role() = 'service_role');
drop policy if exists auth_signup_attempts_insert_service on public.auth_signup_attempts;
create policy auth_signup_attempts_insert_service on public.auth_signup_attempts
  for insert with check (auth.role() = 'service_role');
drop policy if exists auth_signup_attempts_update_service on public.auth_signup_attempts;
create policy auth_signup_attempts_update_service on public.auth_signup_attempts
  for update using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
drop policy if exists auth_signup_attempts_delete_service on public.auth_signup_attempts;
create policy auth_signup_attempts_delete_service on public.auth_signup_attempts
  for delete using (auth.role() = 'service_role');

-- =====================================================================
-- 1. Registration method
-- =====================================================================
-- Constrained to 'email' on purpose: the only supported bootstrap path is
-- email-backed. Adding a phone-only path would require widening this check
-- explicitly, which makes the decision visible in review rather than something a
-- route change can introduce on its own.
do $$
begin
  alter table public.auth_signup_attempts
    add column method text not null default 'email';
exception
  when duplicate_column then
    raise notice 'auth_signup_attempts.method already exists, skipping';
end $$;

alter table public.auth_signup_attempts
  drop constraint if exists auth_signup_attempts_method_check;
alter table public.auth_signup_attempts
  add constraint auth_signup_attempts_method_check
  check (method in ('email'));

-- =====================================================================
-- 2. Email-first status ladder
-- =====================================================================
-- pending -> email_verified -> phone_verified -> completed, plus expired.
do $$
begin
  alter table public.auth_signup_attempts
    add column email_verified_at timestamptz;
exception
  when duplicate_column then
    raise notice 'auth_signup_attempts.email_verified_at already exists, skipping';
end $$;

alter table public.auth_signup_attempts
  drop constraint if exists auth_signup_attempts_status_check;
alter table public.auth_signup_attempts
  add constraint auth_signup_attempts_status_check
  check (status in ('pending', 'email_verified', 'phone_verified', 'completed', 'expired'));

-- Active-attempt uniqueness and expiry sweeps must treat 'email_verified' as
-- in-flight, otherwise a half-finished attempt stops reserving its email/phone.
drop index if exists auth_signup_active_email_uniq;
create unique index auth_signup_active_email_uniq
  on public.auth_signup_attempts (lower(email))
  where status in ('pending', 'email_verified', 'phone_verified');

drop index if exists auth_signup_active_phone_uniq;
create unique index auth_signup_active_phone_uniq
  on public.auth_signup_attempts (phone)
  where status in ('pending', 'email_verified', 'phone_verified');

drop index if exists auth_signup_attempts_expiry_idx;
create index auth_signup_attempts_expiry_idx
  on public.auth_signup_attempts (expires_at)
  where status in ('pending', 'email_verified', 'phone_verified');

-- =====================================================================
-- 3. "profile_complete implies both contacts verified"
-- =====================================================================
-- Backfill decision: email_verified_at is introduced by this line of work, so
-- existing members legitimately have profile_complete = true with a null
-- timestamp, and the check below would reject every future write to those rows.
-- We therefore stamp the legacy rows from created_at, which asserts that accounts
-- already treated as complete are trusted as verified. The alternative — flipping
-- them back to profile_complete = false — would force the entire existing
-- membership through onboarding again, so it is deliberately not done here. The
-- notice reports how many rows were affected; review that number.
do $$
declare
  v_email_backfilled integer;
  v_phone_backfilled integer;
begin
  with updated as (
    update public.users
      set email_verified_at = coalesce(email_verified_at, created_at, now())
      where profile_complete is true and email_verified_at is null and email is not null
      returning 1
  )
  select count(*) into v_email_backfilled from updated;

  with updated as (
    update public.users
      set phone_verified_at = coalesce(phone_verified_at, created_at, now())
      where profile_complete is true and phone_verified_at is null and phone is not null
      returning 1
  )
  select count(*) into v_phone_backfilled from updated;

  raise notice 'legacy verified-contact backfill: % email rows, % phone rows',
    v_email_backfilled, v_phone_backfilled;
end $$;

-- Any row still violating the invariant has a genuinely missing contact (null
-- name, email or phone) and cannot be repaired by stamping a timestamp. Fail
-- loudly rather than silently demoting real members.
do $$
declare
  v_unrepairable integer;
begin
  select count(*) into v_unrepairable
  from public.users
  where profile_complete is true
    and (
      display_name is null
      or email is null
      or phone is null
      or email_verified_at is null
      or phone_verified_at is null
    );

  if v_unrepairable > 0 then
    raise exception 'auth invariant migration blocked: % complete profiles are missing a contact; inspect them before continuing', v_unrepairable;
  end if;
end $$;

alter table public.users
  drop constraint if exists users_profile_complete_verified_chk;
alter table public.users
  add constraint users_profile_complete_verified_chk
  check (
    profile_complete is not true
    or (
      display_name is not null
      and email is not null
      and phone is not null
      and email_verified_at is not null
      and phone_verified_at is not null
    )
  );

-- =====================================================================
-- Verification queries for the SQL editor
-- =====================================================================
--   select conname from pg_constraint
--   where conrelid = 'public.users'::regclass
--     and conname = 'users_profile_complete_verified_chk';
--
--   select column_name from information_schema.columns
--   where table_schema = 'public' and table_name = 'auth_signup_attempts'
--   order by column_name;
--
--   -- must fail with a check violation:
--   begin;
--   update public.users
--     set profile_complete = true, phone_verified_at = null
--     where id = (select id from public.users where profile_complete is true limit 1);
--   rollback;
