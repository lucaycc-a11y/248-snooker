-- 248 Snooker — booking security foundation (idempotency + rate limiting).
-- Run this in the Supabase SQL Editor for project wqmciwieiqvnswvspdyz.
-- Safe to re-run: every statement is idempotent.
--
-- SCOPE: This migration intentionally contains ONLY the new, self-contained
-- security tables that do not depend on the existing bookings/slots schema:
--   1. webhook_events  — Stripe webhook idempotency ledger
--   2. rate_limits     — fixed-window request counters + atomic check RPC
--   3. pg_cron cleanup — prunes stale rate-limit rows
--
-- The slot-lock columns, try_lock_slot()/confirm_booking()/update_member_tier()
-- RPCs, iot_commands and admin_actions_log are deliberately deferred to a later
-- migration, because they must be written against the LIVE column names of the
-- existing public.bookings / public.slots tables (read defensively in
-- lib/data/getMember.ts) — which are not defined in this repo. Writing them
-- against guessed columns would silently no-op. Confirm that DDL first.

-- ════════════════════════════════════════════════════════════════════
-- 0. Extensions (idempotent — safe if already enabled by 0002).
-- ════════════════════════════════════════════════════════════════════
create extension if not exists pg_cron;

-- ════════════════════════════════════════════════════════════════════
-- 1. webhook_events — Stripe webhook idempotency.
--    The webhook handler INSERTs event.id here BEFORE processing. The unique
--    PK makes a duplicate delivery fail the insert, so we process each event
--    exactly once even though Stripe may deliver the same event many times.
-- ════════════════════════════════════════════════════════════════════
create table if not exists public.webhook_events (
  id            text primary key,            -- Stripe event.id (evt_...)
  type          text not null,               -- e.g. payment_intent.succeeded
  received_at   timestamptz not null default now(),
  processed_at  timestamptz,                 -- set when handling completes
  status        text not null default 'received'
                  check (status in ('received', 'processed', 'failed')),
  error         text,
  payload       jsonb                        -- optional: raw event for audit/replay
);

create index if not exists webhook_events_received_idx
  on public.webhook_events (received_at desc);

alter table public.webhook_events enable row level security;

-- No policies => only service_role / postgres (which bypass RLS) can read or
-- write. The webhook route uses the service-role client; nothing client-side
-- should ever see this table.
comment on table public.webhook_events is
  'Stripe webhook idempotency ledger. Written only by the webhook route via service_role. RLS on, no policies = service_role only.';


-- ════════════════════════════════════════════════════════════════════
-- 2. rate_limits — fixed-window counters keyed by (bucket, identifier).
--    `bucket` groups a route family (e.g. 'booking_quote', 'auth'); identifier
--    is an IP or user_id. One row per (bucket, identifier, window_start).
-- ════════════════════════════════════════════════════════════════════
create table if not exists public.rate_limits (
  bucket        text not null,
  identifier    text not null,
  window_start  timestamptz not null,
  count         integer not null default 0,
  primary key (bucket, identifier, window_start)
);

create index if not exists rate_limits_window_idx
  on public.rate_limits (window_start);

alter table public.rate_limits enable row level security;
-- Service-role only (no policies). Enforcement runs server-side.
comment on table public.rate_limits is
  'Fixed-window rate-limit counters. Written only server-side via service_role.';

-- Atomic check-and-increment. Returns true if the request is ALLOWED, false if
-- the limit is exceeded. The window is bucketed by truncating now() to the
-- window size, so all requests in the same window share one counter row.
--
--   p_bucket          route family, e.g. 'booking_quote'
--   p_identifier      IP address or 'user:<uuid>'
--   p_max             max requests allowed per window
--   p_window_seconds  window length in seconds (e.g. 60)
--
-- security definer so the anon/auth caller can invoke it without direct table
-- access; the function itself does the privileged write.
create or replace function public.check_rate_limit(
  p_bucket text,
  p_identifier text,
  p_max integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_start timestamptz;
  v_count        integer;
begin
  -- Truncate now() to the start of the current window.
  v_window_start := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );

  insert into public.rate_limits (bucket, identifier, window_start, count)
  values (p_bucket, p_identifier, v_window_start, 1)
  on conflict (bucket, identifier, window_start)
    do update set count = public.rate_limits.count + 1
  returning count into v_count;

  return v_count <= p_max;
end;
$$;

comment on function public.check_rate_limit is
  'Atomic fixed-window rate limit. Returns true if allowed, false if over limit.';

-- Lock down EXECUTE: only the service role should call this (server-side).
revoke all on function public.check_rate_limit(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.check_rate_limit(text, text, integer, integer) to service_role;


-- ════════════════════════════════════════════════════════════════════
-- 3. pg_cron cleanup — prune rate-limit rows older than 1 hour and resolved
--    webhook events older than 30 days. Keeps both tables small.
--    02:23 UTC daily — off-peak, non-round minute.
-- ════════════════════════════════════════════════════════════════════
create or replace function public.cleanup_security_tables()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.rate_limits
   where window_start < now() - interval '1 hour';

  delete from public.webhook_events
   where status = 'processed'
     and received_at < now() - interval '30 days';
end;
$$;

select cron.unschedule('cleanup-security-tables')
  where exists (select 1 from cron.job where jobname = 'cleanup-security-tables');

select cron.schedule(
  'cleanup-security-tables',
  '23 2 * * *',
  $$select public.cleanup_security_tables();$$
);
