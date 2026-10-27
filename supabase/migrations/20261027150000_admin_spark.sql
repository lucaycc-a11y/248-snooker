-- Spark: the admin AI assistant. Chats, messages, and every proposed database change
-- (with its before/after so it can be undone and re-applied). RLS on, no policies:
-- only the service role (server routes behind withAdminSecurity) touches these.
create table if not exists public.admin_spark_chats (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null,
  admin_email text not null,
  title text not null default '新對話',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists admin_spark_chats_admin_idx on public.admin_spark_chats (admin_user_id, updated_at desc);

create table if not exists public.admin_spark_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.admin_spark_chats(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null default '',
  blocks jsonb not null default '[]'::jsonb,
  steps jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists admin_spark_messages_chat_idx on public.admin_spark_messages (chat_id, created_at);

create table if not exists public.admin_spark_actions (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid references public.admin_spark_chats(id) on delete set null,
  message_id uuid references public.admin_spark_messages(id) on delete set null,
  admin_user_id uuid not null,
  admin_email text not null,
  kind text not null,
  summary text not null,
  risk text not null default 'normal' check (risk in ('normal','high')),
  params jsonb not null default '{}'::jsonb,
  preview jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending','executed','rejected','expired','failed','undone')),
  result jsonb,
  undo_data jsonb,
  error text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  decided_at timestamptz,
  executed_at timestamptz,
  undone_at timestamptz,
  redo_count integer not null default 0
);
create index if not exists admin_spark_actions_recent_idx on public.admin_spark_actions (created_at desc);
create index if not exists admin_spark_actions_chat_idx on public.admin_spark_actions (chat_id);

alter table public.admin_spark_chats enable row level security;
alter table public.admin_spark_messages enable row level security;
alter table public.admin_spark_actions enable row level security;
