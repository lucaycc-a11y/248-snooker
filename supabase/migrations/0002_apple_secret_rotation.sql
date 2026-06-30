-- Automated Apple OAuth client-secret rotation
--
-- Apple "Sign in with Apple" client secrets expire after at most 6 months.
-- This migration sets up a daily pg_cron job that calls the
-- `rotate-apple-secret` Edge Function once the current secret is >= 150 days
-- old, so rotation always happens comfortably before the 180-day cliff.
--
-- Why a daily gate instead of an "every 150 days" cron?
--   * 5-field cron cannot express "every 150 days" (day-of-month maxes at 31).
--   * A daily check that compares last_rotated_at self-heals: if a rotation
--     fails, it simply retries the next day instead of waiting another 150.

-- 1. Extensions (idempotent — safe if already enabled).
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 2. Singleton tracking table. The boolean PK + CHECK guarantees one row only.
create table if not exists public.apple_secret_rotation (
  id              boolean primary key default true check (id),
  last_rotated_at timestamptz,
  last_jwt_exp    timestamptz,
  last_status     text,
  updated_at      timestamptz not null default now()
);

-- Seed the single row. last_rotated_at = NULL means "never rotated", so the
-- first cron tick will fire a rotation immediately.
insert into public.apple_secret_rotation (id)
values (true)
on conflict (id) do nothing;

-- 3. Lock the table down. It holds only operational metadata (no secrets), but
-- it must never be client-readable: RLS on, and no policies = only the
-- service_role / postgres roles (which bypass RLS) can touch it.
alter table public.apple_secret_rotation enable row level security;

comment on table public.apple_secret_rotation is
  'Singleton row tracking automated Apple OAuth client-secret rotation. Written only by the rotate-apple-secret Edge Function via service_role.';

-- 4. Store the values the cron job needs to invoke the Edge Function in Vault,
-- so they never appear in plaintext inside cron.job. Replace the placeholders
-- below in the SQL Editor before (or just after) running this migration.
--
--   PROJECT_URL  -> https://wqmciwieiqvnswvspdyz.supabase.co
--   CRON_SECRET  -> the same value you set via `supabase secrets set CRON_SECRET=...`
--
-- These statements are idempotent: update the secret if it already exists.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'project_url') then
    perform vault.create_secret('https://wqmciwieiqvnswvspdyz.supabase.co', 'project_url');
  end if;
  if not exists (select 1 from vault.secrets where name = 'apple_rotation_cron_secret') then
    -- Placeholder — overwrite with the real CRON_SECRET (see deploy commands).
    perform vault.create_secret('REPLACE_WITH_CRON_SECRET', 'apple_rotation_cron_secret');
  end if;
end $$;

-- 5. The trigger function: fire the Edge Function only when due (>= 150 days
-- since last success, or never rotated). Runs daily.
create or replace function public.trigger_apple_secret_rotation()
returns void
language plpgsql
security definer
set search_path = public, vault, net
as $$
declare
  v_due        boolean;
  v_url        text;
  v_secret     text;
begin
  -- Due if never rotated, or last rotation was >= 150 days ago.
  select (last_rotated_at is null or last_rotated_at < now() - interval '150 days')
    into v_due
  from public.apple_secret_rotation
  where id = true;

  if not coalesce(v_due, true) then
    return; -- not yet due; nothing to do today
  end if;

  select decrypted_secret into v_url
  from vault.decrypted_secrets where name = 'project_url';

  select decrypted_secret into v_secret
  from vault.decrypted_secrets where name = 'apple_rotation_cron_secret';

  -- Async HTTP POST to the Edge Function; pg_net delivers it out of band.
  perform net.http_post(
    url     := v_url || '/functions/v1/rotate-apple-secret',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_secret
    ),
    body    := '{}'::jsonb
  );
end;
$$;

-- 6. Schedule the daily check. Unschedule first so re-running is idempotent.
-- 03:17 UTC — an off-peak, non-round minute to avoid the top-of-hour stampede.
select cron.unschedule('apple-secret-rotation')
  where exists (select 1 from cron.job where jobname = 'apple-secret-rotation');

select cron.schedule(
  'apple-secret-rotation',
  '17 3 * * *',
  $$select public.trigger_apple_secret_rotation();$$
);
