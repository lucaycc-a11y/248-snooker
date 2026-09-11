-- Fix Part 4: Allow phone login when phone exists in users.phone even without auth identity
-- This handles cases where users signed up via email/Google/Apple and added phone to profile later

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

  -- FIX: Check BOTH auth_identities AND users.phone
  -- A phone is considered "registered" if it exists in either:
  -- 1. auth_identities (phone identity created via Supabase Auth)
  -- 2. users.phone (phone added to profile, even without phone identity)
  select exists (
    select 1 from public.auth_identities
    where provider = 'phone' and lower(identifier) = lower(p_phone) and verified = true
  ) or exists (
    select 1 from public.users
    where lower(phone) = lower(p_phone)
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

-- Re-grant permissions
revoke all on function public.reserve_login_otp(text, text, boolean) from public, anon, authenticated;
grant execute on function public.reserve_login_otp(text, text, boolean) to service_role;
