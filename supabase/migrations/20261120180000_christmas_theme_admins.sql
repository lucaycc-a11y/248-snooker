-- Christmas theme preview: which admin users see the snow + Christmas wording.
-- Managed from /admin/christmas (super_admin only). Not shown to the public.
create table if not exists public.christmas_theme_admins (
  user_id uuid primary key,
  enabled_by text,
  created_at timestamptz not null default now()
);
alter table public.christmas_theme_admins enable row level security;
-- No policies: only the service role (server routes) reads or writes.
