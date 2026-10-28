-- Admin email composer: saved templates + a send log. Service role only (RLS on, no policies).
create table if not exists public.admin_email_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  subject text not null default '',
  doc jsonb not null,
  custom_html text,
  created_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.admin_email_templates enable row level security;

create table if not exists public.admin_email_sends (
  id uuid primary key default gen_random_uuid(),
  template_id uuid references public.admin_email_templates(id) on delete set null,
  subject text not null,
  audience_kind text not null check (audience_kind in ('test','members','all')),
  recipient_count int not null default 0,
  sent_count int not null default 0,
  failed_count int not null default 0,
  admin_email text,
  created_at timestamptz not null default now()
);
alter table public.admin_email_sends enable row level security;
create index if not exists admin_email_sends_created_idx on public.admin_email_sends (created_at desc);
