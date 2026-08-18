-- Space Pilot room-level device authentication.
-- Password hashes are inserted by scripts/seed-pilot-devices.mjs so plaintext
-- credentials are not stored in this migration or in the repository.

create table if not exists public.pilot_devices (
  id uuid primary key default gen_random_uuid(),
  room_code text not null unique check (room_code in ('r1', 'r2')),
  room_display_name text not null,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.pilot_sessions (
  id uuid primary key default gen_random_uuid(),
  pilot_device_id uuid not null references public.pilot_devices(id) on delete cascade,
  session_token text not null unique,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  last_seen_at timestamptz not null default now()
);

create index if not exists idx_pilot_sessions_token
  on public.pilot_sessions (session_token)
  where revoked_at is null;

alter table public.pilot_devices enable row level security;
alter table public.pilot_sessions enable row level security;

-- Deliberately no client-facing policies. These tables are accessed only through
-- server routes using the service-role client, which bypasses RLS.
comment on table public.pilot_devices is
  'Room-level Space Pilot credentials. Server-side service-role access only.';
comment on table public.pilot_sessions is
  'Revocable Space Pilot sessions. Server-side service-role access only.';
