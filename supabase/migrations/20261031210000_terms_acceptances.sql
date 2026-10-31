-- Terms acceptances (同意條款記錄) — evidence that a member agreed to the venue terms, when,
-- and which text they agreed to (version label + sha256 of the document). One row per checkout
-- attempt that passed the agree-terms gate. Used by violation cases / demand letters.
-- Service role only (RLS on, no policies).

create table if not exists public.terms_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  terms_version text not null,
  terms_hash text not null,
  source text not null,
  ip text,
  user_agent text,
  is_test boolean not null default false,
  accepted_at timestamptz not null default now()
);

create index if not exists terms_acceptances_user_idx on public.terms_acceptances (user_id, accepted_at desc);

alter table public.terms_acceptances enable row level security;
