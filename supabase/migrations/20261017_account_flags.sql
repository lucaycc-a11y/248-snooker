-- Account risk flags: shared IP / shared device detection.
-- Single-file migration — apply manually (plain `supabase db push` is unsafe here).
--
-- auth_risk_events  — one row per authentication event we can see server-side.
-- account_flags     — derived groupings (≥2 distinct members sharing a key).
--                     Grouping is computed at read time and upserted here.

create table if not exists auth_risk_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  ip text,
  device_hash text,
  event_type text not null default 'login',
  created_at timestamptz not null default now()
);

create index if not exists auth_risk_events_ip_idx
  on auth_risk_events (ip)
  where ip is not null;

create index if not exists auth_risk_events_device_idx
  on auth_risk_events (device_hash)
  where device_hash is not null;

create index if not exists auth_risk_events_user_idx
  on auth_risk_events (user_id, created_at desc);

create table if not exists account_flags (
  id uuid primary key default gen_random_uuid(),
  flag_type text not null check (flag_type in ('shared_ip','shared_device')),
  flag_key text not null,
  member_ids uuid[] not null default '{}',
  event_count int not null default 0,
  first_seen date,
  last_seen date,
  status text not null default 'open' check (status in ('open','reviewed')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (flag_type, flag_key)
);

create index if not exists account_flags_status_idx
  on account_flags (status, flag_type, last_seen desc);
