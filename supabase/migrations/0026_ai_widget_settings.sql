create table if not exists public.ai_widget_settings (
  id uuid primary key default gen_random_uuid(),
  locale text not null,
  greeting_message text not null,
  suggested_prompts jsonb not null default '[]',
  system_prompt_override text,
  tone text not null default 'friendly' check (tone in ('friendly','professional','playful')),
  updated_at timestamptz default now(),
  updated_by uuid references auth.users(id),
  unique (locale)
);

alter table public.ai_widget_settings enable row level security;

create policy "ai_widget_settings_public_read"
  on public.ai_widget_settings for select
  using (true);

create policy "ai_widget_settings_service_role_write"
  on public.ai_widget_settings for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
