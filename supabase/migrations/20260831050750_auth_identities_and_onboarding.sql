-- auth_identities: our identity ledger for dedup and onboarding
create table public.auth_identities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('email', 'phone', 'google', 'apple')),
  identifier text not null,          -- email / phone / provider-sub
  verified boolean not null default false,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- one verified identity per (provider, identifier) — prevents two users claiming the same email
create unique index auth_identities_verified_unique
  on public.auth_identities (provider, lower(identifier))
  where verified = true;

-- fast lookups by identifier (for duplicate-check in signup)
create index auth_identities_provider_identifier
  on public.auth_identities (provider, lower(identifier));

-- fast lookups by user_id (for profile completeness checks)
create index auth_identities_user_id
  on public.auth_identities (user_id);

-- onboarding_status on public.users
alter table public.users
  add column if not exists onboarding_status text
  not null default 'pending_second_identity'
  check (onboarding_status in (
    'pending_first_identity',
    'pending_second_identity',
    'complete'
  ));
