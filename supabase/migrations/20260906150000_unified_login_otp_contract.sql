-- Unified login/profile-binding OTP ledger and policy contract.
-- Provider-generated OTP cleartext is never stored locally. Engagelab remains
-- the verification authority until an application-supplied-code provider exists.

create table if not exists public.whatsapp_otps (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  purpose text not null check (purpose in ('login', 'profile_binding')),
  code_hash text,
  status text not null default 'pending'
    check (status in ('pending', 'verified', 'expired', 'superseded')),
  provider_message_id text,
  provider_channel text,
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 8 check (max_attempts > 0),
  expires_at timestamptz not null,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.whatsapp_otps add column if not exists code_hash text;
alter table public.whatsapp_otps add column if not exists provider_message_id text;
alter table public.whatsapp_otps add column if not exists provider_channel text;
alter table public.whatsapp_otps add column if not exists updated_at timestamptz not null default now();
alter table public.whatsapp_otps alter column max_attempts set default 8;

create index if not exists whatsapp_otps_phone_purpose_status_idx
  on public.whatsapp_otps (phone, purpose, status);
create index if not exists whatsapp_otps_provider_message_id_idx
  on public.whatsapp_otps (provider_message_id)
  where provider_message_id is not null;
create index if not exists whatsapp_otps_pending_expiry_idx
  on public.whatsapp_otps (expires_at)
  where status = 'pending';
create index if not exists whatsapp_otps_created_at_idx
  on public.whatsapp_otps (created_at);

create table if not exists public.auth_otp_policy (
  policy_key text primary key,
  policy_value integer not null check (policy_value > 0),
  updated_at timestamptz not null default now()
);

insert into public.auth_otp_policy (policy_key, policy_value) values
  ('max_attempts', 8),
  ('captcha_after_sends', 6),
  ('captcha_window_seconds', 1800),
  ('lock_after_sends', 15),
  ('send_lock_window_seconds', 7200),
  ('lock_after_failed_groups', 6),
  ('phone_lock_seconds', 900),
  ('otp_expiry_seconds', 300),
  ('resend_cooldown_seconds', 60),
  ('existence_response_floor_ms', 1200)
on conflict (policy_key) do update
  set policy_value = excluded.policy_value, updated_at = now();

create table if not exists public.otp_rate_limit_events (
  id bigint generated always as identity primary key,
  phone text not null,
  purpose text not null check (purpose in ('login', 'profile_binding')),
  event_type text not null check (event_type in (
    'send', 'verify_failure', 'otp_group_failed', 'phone_locked',
    'captcha_required', 'phone_unlocked'
  )),
  otp_id uuid references public.whatsapp_otps(id) on delete set null,
  request_id uuid,
  reason text,
  created_at timestamptz not null default now()
);
create index if not exists otp_rate_limit_events_phone_created_idx
  on public.otp_rate_limit_events (phone, created_at);
create index if not exists otp_rate_limit_events_phone_type_created_idx
  on public.otp_rate_limit_events (phone, event_type, created_at);

create table if not exists public.otp_phone_locks (
  phone text primary key,
  locked_until timestamptz not null,
  reason text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.whatsapp_otps enable row level security;
alter table public.auth_otp_policy enable row level security;
alter table public.otp_rate_limit_events enable row level security;
alter table public.otp_phone_locks enable row level security;
revoke all on table public.whatsapp_otps, public.auth_otp_policy,
  public.otp_rate_limit_events, public.otp_phone_locks
  from public, anon, authenticated;

create or replace function public.otp_policy_value(p_key text, p_default integer)
returns integer language sql stable security definer set search_path = public
as $$
  select coalesce((select policy_value from public.auth_otp_policy where policy_key = p_key), p_default);
$$;

-- Return contract:
-- ok, request_id, otp_id, purpose, phone_status, reason,
-- retry_after_seconds, requires_captcha, locked_until, message_id, channel,
-- expires_at, is_owner.
create or replace function public.reserve_login_otp(
  p_phone text,
  p_purpose text default 'login',
  p_captcha_verified boolean default false
)
returns table (
  ok boolean,
  request_id uuid,
  otp_id uuid,
  purpose text,
  phone_status text,
  reason text,
  retry_after_seconds integer,
  requires_captcha boolean,
  locked_until timestamptz,
  message_id text,
  channel text,
  expires_at timestamptz,
  is_owner boolean
)
language plpgsql security definer set search_path = public
as $$
declare
  v_existing public.whatsapp_otps%rowtype;
  v_lock public.otp_phone_locks%rowtype;
  v_now timestamptz := now();
  v_expiry timestamptz;
  v_captcha boolean := false;
  v_send_count integer;
  v_failed_groups integer;
  v_retry integer;
  v_phone_exists boolean;
  v_id uuid;
begin
  if p_purpose not in ('login', 'profile_binding') then
    return query select false, null::uuid, null::uuid, p_purpose, null::text,
      'invalid_purpose', null::integer, false, null::timestamptz, null::text,
      null::text, null::timestamptz, false;
    return;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_phone || ':' || p_purpose, 0));

  select exists (
    select 1 from public.auth_identities
    where provider = 'phone' and lower(identifier) = lower(p_phone) and verified = true
  ) into v_phone_exists;

  if p_purpose = 'login' and not v_phone_exists then
    return query select false, null::uuid, null::uuid, p_purpose, 'not_registered',
      'phone_not_registered', null::integer, false, null::timestamptz, null::text,
      null::text, null::timestamptz, false;
    return;
  end if;

  select * into v_lock from public.otp_phone_locks where phone = p_phone;
  if found and v_lock.locked_until > v_now then
    v_retry := greatest(1, ceil(extract(epoch from (v_lock.locked_until - v_now)))::integer);
    return query select false, null::uuid, null::uuid, p_purpose, 'locked',
      'phone_locked', v_retry, false, v_lock.locked_until, null::text, null::text,
      null::timestamptz, false;
    return;
  elsif found then
    delete from public.otp_phone_locks where phone = p_phone;
  end if;

  select count(*)::integer into v_send_count
  from public.otp_rate_limit_events
  where phone = p_phone and event_type = 'send'
    and created_at >= v_now - make_interval(secs => public.otp_policy_value('captcha_window_seconds', 1800));
  v_captcha := v_send_count >= public.otp_policy_value('captcha_after_sends', 6);

  select count(*)::integer into v_send_count
  from public.otp_rate_limit_events
  where phone = p_phone and event_type = 'send'
    and created_at >= v_now - make_interval(secs => public.otp_policy_value('send_lock_window_seconds', 7200));
  select count(*)::integer into v_failed_groups
  from public.otp_rate_limit_events
  where phone = p_phone and event_type = 'otp_group_failed'
    and created_at >= v_now - make_interval(secs => public.otp_policy_value('send_lock_window_seconds', 7200));

  if v_send_count > public.otp_policy_value('lock_after_sends', 15)
     or v_failed_groups >= public.otp_policy_value('lock_after_failed_groups', 6) then
    v_expiry := v_now + make_interval(secs => public.otp_policy_value('phone_lock_seconds', 900));
    insert into public.otp_phone_locks(phone, locked_until, reason)
      values (p_phone, v_expiry,
        case when v_send_count > public.otp_policy_value('lock_after_sends', 15)
          then 'send_limit' else 'failed_otp_groups' end)
      on conflict (phone) do update set locked_until = excluded.locked_until,
        reason = excluded.reason, updated_at = v_now;
    insert into public.otp_rate_limit_events(phone, purpose, event_type, reason)
      values (p_phone, p_purpose, 'phone_locked',
        case when v_send_count > public.otp_policy_value('lock_after_sends', 15)
          then 'send_limit' else 'failed_otp_groups' end);
    return query select false, null::uuid, null::uuid, p_purpose, 'locked',
      'phone_locked', public.otp_policy_value('phone_lock_seconds', 900), v_captcha,
      v_expiry, null::text, null::text, null::timestamptz, false;
    return;
  end if;

  select * into v_existing from public.whatsapp_otps
  where phone = p_phone and purpose = p_purpose and status = 'pending'
  order by created_at desc limit 1;
  if found and v_existing.expires_at > v_now then
    v_retry := greatest(0, ceil(extract(epoch from ((v_existing.created_at + make_interval(secs => public.otp_policy_value('resend_cooldown_seconds', 60))) - v_now)))::integer);
    if v_retry > 0 then
      return query select false, v_existing.id, v_existing.id, p_purpose, 'valid',
        'cooldown', v_retry, v_captcha, null::timestamptz,
        v_existing.provider_message_id, v_existing.provider_channel, v_existing.expires_at, false;
      return;
    end if;
    update public.whatsapp_otps set status = 'superseded', updated_at = v_now where id = v_existing.id;
  end if;

  v_expiry := v_now + make_interval(secs => public.otp_policy_value('otp_expiry_seconds', 300));
  insert into public.whatsapp_otps(phone, purpose, max_attempts, expires_at)
    values (p_phone, p_purpose, public.otp_policy_value('max_attempts', 8), v_expiry)
    returning id into v_id;
  insert into public.otp_rate_limit_events(phone, purpose, event_type, otp_id)
    values (p_phone, p_purpose, 'send', v_id);
  return query select true, v_id, v_id, p_purpose, 'valid', 'reserved', null::integer,
    v_captcha, null::timestamptz, null::text, null::text, v_expiry, true;
end;
$$;

-- Return contract: ok, reason, otp_id, expires_at.
create or replace function public.complete_login_otp(
  p_request_id uuid,
  p_message_id text,
  p_channel text
)
returns table (ok boolean, reason text, otp_id uuid, expires_at timestamptz)
language plpgsql security definer set search_path = public
as $$
begin
  return query
  update public.whatsapp_otps
  set provider_message_id = p_message_id, provider_channel = p_channel, updated_at = now()
  where id = p_request_id and status = 'pending' and provider_message_id is null and expires_at > now()
  returning true, 'completed'::text, id, whatsapp_otps.expires_at;
  if not found then
    return query select false, 'reservation_not_pending', null::uuid, null::timestamptz;
  end if;
end;
$$;

-- Provider-compatible verification result. The route must call Engagelab and
-- then call otp_record_provider_verification with the result.
-- Return contract: ok, otp_id, status, reason, attempts, remaining_attempts,
-- expires_at, locked_until.
create or replace function public.verify_login_otp(
  p_phone text,
  p_purpose text,
  p_code text
)
returns table (
  ok boolean,
  otp_id uuid,
  status text,
  reason text,
  attempts integer,
  remaining_attempts integer,
  expires_at timestamptz,
  locked_until timestamptz
)
language plpgsql security definer set search_path = public
as $$
begin
  return query select false, null::uuid, null::text, 'provider_verification_required',
    0, null::integer, null::timestamptz, null::timestamptz;
end;
$$;

create or replace function public.otp_record_provider_verification(
  p_phone text,
  p_purpose text,
  p_message_id text,
  p_verified boolean
)
returns table (
  ok boolean,
  otp_id uuid,
  status text,
  reason text,
  attempts integer,
  remaining_attempts integer,
  expires_at timestamptz,
  locked_until timestamptz
)
language plpgsql security definer set search_path = public
as $$
declare v_row public.whatsapp_otps%rowtype; v_groups integer; v_lock_until timestamptz;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_phone || ':' || p_purpose, 0));
  select * into v_row from public.whatsapp_otps
    where phone = p_phone and purpose = p_purpose and status = 'pending'
      and (p_message_id is null or provider_message_id = p_message_id)
    order by created_at desc limit 1 for update;
  if not found then return query select false, null::uuid, 'expired'::text, 'not_found', 0, 0, null::timestamptz, null::timestamptz; return; end if;
  if v_row.expires_at <= now() then
    update public.whatsapp_otps set status = 'expired', updated_at = now() where id = v_row.id;
    return query select false, v_row.id, 'expired'::text, 'expired', v_row.attempts, 0, v_row.expires_at, null::timestamptz; return;
  end if;
  if p_verified then
    update public.whatsapp_otps set status = 'verified', verified_at = now(), updated_at = now() where id = v_row.id;
    return query select true, v_row.id, 'verified'::text, 'verified', v_row.attempts, v_row.max_attempts - v_row.attempts, v_row.expires_at, null::timestamptz; return;
  end if;
  update public.whatsapp_otps set attempts = attempts + 1, updated_at = now() where id = v_row.id returning * into v_row;
  insert into public.otp_rate_limit_events(phone, purpose, event_type, otp_id, reason) values (p_phone, p_purpose, 'verify_failure', v_row.id, 'provider_rejected');
  if v_row.attempts >= v_row.max_attempts then
    update public.whatsapp_otps set status = 'expired', updated_at = now() where id = v_row.id;
    insert into public.otp_rate_limit_events(phone, purpose, event_type, otp_id, reason) values (p_phone, p_purpose, 'otp_group_failed', v_row.id, 'max_attempts');
    select count(*)::integer into v_groups from public.otp_rate_limit_events where phone = p_phone and event_type = 'otp_group_failed' and created_at >= now() - make_interval(secs => public.otp_policy_value('send_lock_window_seconds', 7200));
    if v_groups >= public.otp_policy_value('lock_after_failed_groups', 6) then
      v_lock_until := now() + make_interval(secs => public.otp_policy_value('phone_lock_seconds', 900));
      insert into public.otp_phone_locks(phone, locked_until, reason) values (p_phone, v_lock_until, 'failed_otp_groups') on conflict (phone) do update set locked_until = excluded.locked_until, reason = excluded.reason, updated_at = now();
    end if;
    return query select false, v_row.id, 'expired'::text, 'max_attempts_reached', v_row.attempts, 0, v_row.expires_at, v_lock_until; return;
  end if;
  return query select false, v_row.id, 'pending'::text, 'invalid_code', v_row.attempts, v_row.max_attempts - v_row.attempts, v_row.expires_at, null::timestamptz;
end;
$$;

create or replace function public.expire_login_otp(p_request_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.whatsapp_otps set status = 'expired', updated_at = now() where id = p_request_id and status = 'pending';
$$;

create or replace function public.admin_unlock_phone(p_phone text)
returns table (ok boolean, phone text, unlocked_events integer)
language plpgsql security definer set search_path = public
as $$
declare v_count integer;
begin
  if not exists (select 1 from public.admin_users where user_id = auth.uid() and role = 'super_admin' and invite_status = 'active') then
    raise exception 'super_admin_required' using errcode = '42501';
  end if;
  delete from public.otp_phone_locks where phone = p_phone;
  update public.otp_rate_limit_events set reason = coalesce(reason, '') || ':unlocked' where phone = p_phone and event_type in ('captcha_required', 'phone_locked');
  get diagnostics v_count = row_count;
  insert into public.otp_rate_limit_events(phone, purpose, event_type, reason) values (p_phone, 'login', 'phone_unlocked', 'admin_unlock');
  return query select true, p_phone, v_count;
end;
$$;

revoke all on function public.otp_policy_value(text, integer), public.reserve_login_otp(text, text), public.complete_login_otp(uuid, text, text), public.verify_login_otp(text, text, text), public.otp_record_provider_verification(text, text, text, boolean), public.expire_login_otp(uuid), public.admin_unlock_phone(text) from public, anon, authenticated;
grant execute on function public.otp_policy_value(text, integer), public.reserve_login_otp(text, text), public.complete_login_otp(uuid, text, text), public.verify_login_otp(text, text, text), public.otp_record_provider_verification(text, text, text, boolean), public.expire_login_otp(uuid), public.admin_unlock_phone(text) to service_role;
