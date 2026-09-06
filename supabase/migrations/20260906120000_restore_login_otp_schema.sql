-- Restore the schema contract consumed by app/api/otp/send/route.ts.
-- Engagelab owns OTP generation and verification; the application stores only
-- provider metadata here, never a clear OTP value.
create table if not exists public.login_otp_requests (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  purpose text not null default 'login' check (purpose = 'login'),
  status text not null default 'pending' check (status in ('pending', 'verified', 'expired')),
  message_id text,
  channel text,
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  created_at timestamptz not null default now()
);

create unique index if not exists login_otp_pending_phone_purpose_uniq
  on public.login_otp_requests (phone, purpose) where status = 'pending';
create index if not exists login_otp_message_id_idx
  on public.login_otp_requests (message_id) where message_id is not null;
create index if not exists login_otp_expiry_idx
  on public.login_otp_requests (expires_at) where status = 'pending';
create index if not exists login_otp_created_at_idx
  on public.login_otp_requests (created_at);

alter table public.login_otp_requests enable row level security;
revoke all on table public.login_otp_requests from public, anon, authenticated;

create or replace function public.reserve_login_otp(p_phone text)
returns table (request_id uuid, message_id text, channel text, expires_at timestamptz, is_owner boolean)
language plpgsql security definer set search_path = public
as $$
declare existing public.login_otp_requests;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_phone || ':login', 0));
  update public.login_otp_requests set status = 'expired'
    where phone = p_phone and purpose = 'login' and status = 'pending' and expires_at <= now();
  select * into existing from public.login_otp_requests
    where phone = p_phone and purpose = 'login' and status = 'pending'
    order by created_at desc limit 1;
  if found then
    return query select existing.id, existing.message_id, existing.channel, existing.expires_at, false;
    return;
  end if;
  return query insert into public.login_otp_requests (phone)
    values (p_phone) returning id, message_id, channel, expires_at, true;
end;
$$;

create or replace function public.complete_login_otp(p_request_id uuid, p_message_id text, p_channel text)
returns boolean language plpgsql security definer set search_path = public
as $$
begin
  update public.login_otp_requests set message_id = p_message_id, channel = p_channel
    where id = p_request_id and status = 'pending' and message_id is null and expires_at > now();
  return found;
end;
$$;

create or replace function public.expire_login_otp(p_request_id uuid)
returns void language sql security definer set search_path = public
as $$
  update public.login_otp_requests set status = 'expired'
    where id = p_request_id and status = 'pending';
$$;

revoke all on function public.reserve_login_otp(text) from public, anon, authenticated;
revoke all on function public.complete_login_otp(uuid, text, text) from public, anon, authenticated;
revoke all on function public.expire_login_otp(uuid) from public, anon, authenticated;
grant execute on function public.reserve_login_otp(text) to service_role;
grant execute on function public.complete_login_otp(uuid, text, text) to service_role;
grant execute on function public.expire_login_otp(uuid) to service_role;

-- Compatibility ledger used by existing cleanup jobs and operational queries.
create table if not exists public.whatsapp_otps (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  purpose text not null default 'login',
  code_hash text not null,
  status text not null default 'pending' check (status in ('pending', 'verified', 'expired', 'superseded')),
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  verified_at timestamptz,
  message_id text,
  channel text
);
create index if not exists whatsapp_otps_phone_purpose_status_idx
  on public.whatsapp_otps (phone, purpose, status);
alter table public.whatsapp_otps enable row level security;
revoke all on table public.whatsapp_otps from public, anon, authenticated;

-- cleanup_expired_otps() expects this table to exist. The login route continues
-- to use Engagelab verification because its clear code is never stored locally.
