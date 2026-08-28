-- Auth flow redesign: durable identity invariants, pending signups, and contact changes.
--
-- Pre-migration audit (2026-08-28): the repository contains no migration that adds
-- a unique constraint/index to public.users.email or public.users.phone. The base
-- public.users table is provisioned outside this repository, so these checks fail
-- loudly if legacy duplicate data must be cleaned before the invariant is added.
-- Run the duplicate queries below before applying this migration in production:
--
--   select lower(email), count(*) from public.users
--   where email is not null group by lower(email) having count(*) > 1;
--   select phone, count(*) from public.users
--   where phone is not null group by phone having count(*) > 1;
--
-- Unique indexes are database-level uniqueness guarantees (and are preferable here
-- to assuming a constraint name on the externally-provisioned users table).

do $$
begin
  if exists (
    select 1 from public.users
    where email is not null
    group by lower(email)
    having count(*) > 1
  ) then
    raise exception 'auth identity migration blocked: duplicate email values exist';
  end if;

  if exists (
    select 1 from public.users
    where phone is not null
    group by phone
    having count(*) > 1
  ) then
    raise exception 'auth identity migration blocked: duplicate phone values exist';
  end if;
end $$;

create unique index if not exists users_email_lower_uniq
  on public.users (lower(email)) where email is not null;

create unique index if not exists users_phone_uniq
  on public.users (phone) where phone is not null;

do $$
begin
  alter table public.users add column email_verified_at timestamptz;
exception
  when duplicate_column then
    raise notice 'email_verified_at already exists, skipping';
end $$;

create table if not exists public.auth_signup_attempts (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  email text not null,
  phone text not null,
  sms_message_id text,
  phone_verified_at timestamptz,
  email_code_hash text,
  email_code_expires_at timestamptz,
  email_attempts integer not null default 0,
  status text not null default 'pending'
    check (status in ('pending', 'phone_verified', 'completed', 'expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  completed_at timestamptz
);

create unique index if not exists auth_signup_active_email_uniq
  on public.auth_signup_attempts (lower(email))
  where status in ('pending', 'phone_verified');
create unique index if not exists auth_signup_active_phone_uniq
  on public.auth_signup_attempts (phone)
  where status in ('pending', 'phone_verified');
create index if not exists auth_signup_attempts_expiry_idx
  on public.auth_signup_attempts (expires_at)
  where status in ('pending', 'phone_verified');

create table if not exists public.contact_change_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('email', 'phone')),
  current_value text not null,
  new_value text not null,
  current_method text not null check (current_method in ('password', 'otp')),
  current_message_id text,
  current_code_hash text,
  current_code_expires_at timestamptz,
  current_verified_at timestamptz,
  new_code_hash text,
  new_code_expires_at timestamptz,
  new_message_id text,
  new_verified_at timestamptz,
  attempts integer not null default 0,
  status text not null default 'awaiting_current'
    check (status in ('awaiting_current', 'awaiting_new', 'completed', 'expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  completed_at timestamptz
);

create unique index if not exists contact_change_active_user_kind_uniq
  on public.contact_change_requests (user_id, kind)
  where status in ('awaiting_current', 'awaiting_new');
create index if not exists contact_change_expiry_idx
  on public.contact_change_requests (expires_at)
  where status in ('awaiting_current', 'awaiting_new');

alter table public.auth_signup_attempts enable row level security;
alter table public.contact_change_requests enable row level security;

-- Both tables contain verification material and are service-role only. Explicit
-- per-operation policies document that posture and prevent accidental exposure if
-- a future client role is granted table privileges.
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

drop policy if exists contact_change_requests_select_service on public.contact_change_requests;
create policy contact_change_requests_select_service on public.contact_change_requests
  for select using (auth.role() = 'service_role');
drop policy if exists contact_change_requests_insert_service on public.contact_change_requests;
create policy contact_change_requests_insert_service on public.contact_change_requests
  for insert with check (auth.role() = 'service_role');
drop policy if exists contact_change_requests_update_service on public.contact_change_requests;
create policy contact_change_requests_update_service on public.contact_change_requests
  for update using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
drop policy if exists contact_change_requests_delete_service on public.contact_change_requests;
create policy contact_change_requests_delete_service on public.contact_change_requests
  for delete using (auth.role() = 'service_role');

-- Atomic public.users mutation after the new contact has been verified. Auth's
-- own identity row is updated by the server route with GoTrue admin APIs; this
-- function protects the application row and consumes the request exactly once.
create or replace function public.apply_verified_contact_change(
  p_request_id uuid,
  p_user_id uuid,
  p_verified_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.contact_change_requests;
begin
  select * into v_request
  from public.contact_change_requests
  where id = p_request_id and user_id = p_user_id
  for update;

  if not found or v_request.status <> 'awaiting_new' then
    raise exception 'CONTACT_CHANGE_NOT_READY';
  end if;

  if v_request.expires_at <= now() then
    update public.contact_change_requests
      set status = 'expired'
      where id = p_request_id;
    raise exception 'CONTACT_CHANGE_EXPIRED';
  end if;

  if v_request.kind = 'phone' then
    update public.users
      set phone = v_request.new_value,
          phone_verified_at = p_verified_at,
          updated_at = now()
      where id = p_user_id;
  else
    update public.users
      set email = lower(v_request.new_value),
          email_verified_at = p_verified_at,
          updated_at = now()
      where id = p_user_id;
  end if;

  if not found then
    raise exception 'USER_PROFILE_NOT_FOUND';
  end if;

  update public.contact_change_requests
    set status = 'completed', completed_at = now()
    where id = p_request_id;

  return jsonb_build_object('kind', v_request.kind, 'value', v_request.new_value);
end;
$$;

revoke all on function public.apply_verified_contact_change(uuid, uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function public.apply_verified_contact_change(uuid, uuid, timestamptz)
  to service_role;

-- Verification query / duplicate-insert smoke test for the SQL editor:
--   select indexname from pg_indexes
--   where schemaname = 'public'
--     and indexname in ('users_email_lower_uniq', 'users_phone_uniq');
--
--   begin;
--   insert into public.users (id, email, phone)
--   values (gen_random_uuid(), 'existing@example.test', '+85200000000');
--   insert into public.users (id, email, phone)
--   values (gen_random_uuid(), 'EXISTING@example.test', '+85200000001'); -- fails
--   rollback;
--
-- Do not run the smoke test against production data without replacing the test
-- values and wrapping it in a transaction.
