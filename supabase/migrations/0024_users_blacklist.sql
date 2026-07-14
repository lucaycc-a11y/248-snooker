alter table public.users add column if not exists is_blacklisted boolean not null default false;
