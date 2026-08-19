-- Space Pilot backend: additive schema and server-side business RPCs.
-- Existing tables are untouched except users.total_wins.

create extension if not exists pgcrypto;

alter table public.pilot_devices
  add column if not exists table_number integer;

update public.pilot_devices
set table_number = case room_code when 'r1' then 1 when 'r2' then 2 end
where table_number is null;

alter table public.pilot_devices
  alter column table_number set not null;

create unique index if not exists idx_pilot_devices_table_number
  on public.pilot_devices(table_number);
create index if not exists idx_pilot_sessions_active
  on public.pilot_sessions(session_token) where revoked_at is null;
create index if not exists idx_pilot_sessions_device
  on public.pilot_sessions(pilot_device_id) where revoked_at is null;

create table if not exists public.welcome_lines (
  id uuid primary key default gen_random_uuid(),
  tier text not null check (tier in ('new_member','nova','platinum','diamond','guest')),
  time_period text not null check (time_period in ('morning','afternoon','evening')),
  locale text not null check (locale in ('zh-HK','zh-CN','en')),
  line text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_welcome_lines_lookup
  on public.welcome_lines(tier, time_period, locale);

create table if not exists public.game_sessions (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.bookings(id),
  table_number integer not null check (table_number in (1,2)),
  game_type text not null check (game_type in ('8ball','9ball')),
  scoring_mode text check (scoring_mode in ('match','points')),
  participation_mode text not null check (participation_mode in ('solo','duo','freeplay','ai_scheduled')),
  format text check (format in ('round_robin','swiss','double_elim','wheel','single_elim')),
  status text not null default 'setup' check (status in ('setup','active','paused','completed','abandoned')),
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  constraint scoring_mode_only_9ball check ((game_type = '9ball' and scoring_mode is not null) or (game_type = '8ball' and scoring_mode is null)),
  constraint format_only_multi check ((participation_mode in ('freeplay','ai_scheduled') and format is not null) or participation_mode in ('solo','duo'))
);
create index if not exists idx_game_sessions_table_active on public.game_sessions(table_number) where status in ('setup','active','paused');
create unique index if not exists idx_one_active_session_per_table on public.game_sessions(table_number) where status in ('setup','active','paused');

create table if not exists public.game_players (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.game_sessions(id) on delete cascade,
  user_id uuid references auth.users(id),
  guest_name text,
  guest_id uuid default gen_random_uuid(),
  is_host boolean not null default false,
  team text check (team in ('red','blue')),
  status text not null default 'active' check (status in ('waiting','active','eliminated','withdrawn','done')),
  total_wins_snapshot integer,
  joined_at timestamptz not null default now(),
  constraint player_identity check ((user_id is not null and guest_name is null) or (user_id is null and guest_name is not null))
);
create index if not exists idx_game_players_session on public.game_players(session_id);
create unique index if not exists idx_one_host_per_session on public.game_players(session_id) where is_host = true;

create table if not exists public.game_frames (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.game_sessions(id) on delete cascade,
  frame_no integer not null,
  round_no integer,
  player_a_id uuid references public.game_players(id),
  player_b_id uuid references public.game_players(id),
  red_score integer not null default 0,
  blue_score integer not null default 0,
  winner text check (winner in ('red','blue','walkover_red','walkover_blue')),
  status text not null default 'pending' check (status in ('pending','active','completed')),
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  unique(session_id, frame_no)
);
create index if not exists idx_game_frames_session_active on public.game_frames(session_id) where status = 'active';
create unique index if not exists idx_one_active_frame_per_session on public.game_frames(session_id) where status = 'active';

alter table public.users add column if not exists total_wins integer not null default 0;

create table if not exists public.score_events (
  id uuid primary key default gen_random_uuid(),
  frame_id uuid not null references public.game_frames(id) on delete cascade,
  team text not null check (team in ('red','blue')),
  event_type text not null check (event_type in ('big_gold','small_gold','normal_win','foul_opponent_point','frame_win','manual_adjust')),
  points integer not null,
  reversed boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_score_events_frame_active on public.score_events(frame_id) where reversed = false;

create table if not exists public.renewal_orders (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id),
  session_id uuid references public.game_sessions(id),
  extend_minutes integer not null default 60,
  amount integer not null,
  payment_method text references public.payment_settings(method),
  provider_order_no text unique,
  status text not null default 'pending' check (status in ('pending','paid','failed','expired','cancelled')),
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  expires_at timestamptz not null default (now() + interval '5 minutes')
);
create index if not exists idx_renewal_orders_booking on public.renewal_orders(booking_id);
create unique index if not exists idx_one_pending_renewal_per_booking on public.renewal_orders(booking_id) where status = 'pending';

create table if not exists public.guest_join_requests (
  id uuid primary key default gen_random_uuid(),
  room_code text not null check (room_code in ('r1','r2')),
  session_id uuid references public.game_sessions(id),
  status text not null default 'pending' check (status in ('pending','completed','expired')),
  created_user_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '10 minutes')
);

create or replace function public.add_score_event(p_frame_id uuid, p_team text, p_event_type text, p_points integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_frame public.game_frames;
begin
  if p_team not in ('red','blue') or p_points < 0 then raise exception 'INVALID_SCORE_EVENT'; end if;
  select * into v_frame from public.game_frames where id = p_frame_id and status = 'active' for update;
  if not found then raise exception 'FRAME_NOT_ACTIVE'; end if;
  insert into public.score_events(frame_id, team, event_type, points) values (p_frame_id, p_team, p_event_type, p_points);
  if p_team = 'red' then update public.game_frames set red_score = red_score + p_points where id = p_frame_id;
  else update public.game_frames set blue_score = blue_score + p_points where id = p_frame_id; end if;
  select * into v_frame from public.game_frames where id = p_frame_id;
  return jsonb_build_object('red_score', v_frame.red_score, 'blue_score', v_frame.blue_score);
end; $$;

create or replace function public.undo_last_score_event(p_frame_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_event public.score_events; v_red integer; v_blue integer;
begin
  select * into v_event from public.score_events where frame_id = p_frame_id and reversed = false order by created_at desc, id desc limit 1 for update;
  if not found then select red_score, blue_score into v_red, v_blue from public.game_frames where id = p_frame_id; return jsonb_build_object('undone', false, 'red_score', v_red, 'blue_score', v_blue); end if;
  update public.score_events set reversed = true where id = v_event.id;
  if v_event.team = 'red' then update public.game_frames set red_score = red_score - v_event.points where id = p_frame_id;
  else update public.game_frames set blue_score = blue_score - v_event.points where id = p_frame_id; end if;
  select red_score, blue_score into v_red, v_blue from public.game_frames where id = p_frame_id;
  return jsonb_build_object('undone', true, 'red_score', v_red, 'blue_score', v_blue);
end; $$;

create or replace function public.complete_frame(p_frame_id uuid, p_winner text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_frame public.game_frames; v_team text; v_player public.game_players; v_user_id uuid;
begin
  if p_winner not in ('red','blue','walkover_red','walkover_blue') then raise exception 'INVALID_WINNER'; end if;
  select * into v_frame from public.game_frames where id = p_frame_id for update;
  if not found or v_frame.status <> 'active' then raise exception 'FRAME_NOT_ACTIVE'; end if;
  v_team := case when p_winner in ('red','walkover_red') then 'red' else 'blue' end;
  update public.game_frames set winner = p_winner, status = 'completed', ended_at = now() where id = p_frame_id;
  select * into v_player from public.game_players where session_id = v_frame.session_id and team = v_team and status <> 'withdrawn' order by is_host desc, joined_at asc limit 1;
  if found and v_player.user_id is not null then update public.users set total_wins = total_wins + 1 where id = v_player.user_id returning id into v_user_id; end if;
  return jsonb_build_object('completed', true, 'winner', p_winner, 'winner_user_id', v_user_id);
end; $$;

create or replace function public.check_renewal_availability(p_booking_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_booking public.bookings; v_next_start time; v_gap numeric; v_period text; v_rate jsonb; v_amount integer;
begin
  select * into v_booking from public.bookings where id = p_booking_id and status = 'confirmed';
  if not found then raise exception 'BOOKING_NOT_FOUND'; end if;
  select start_time into v_next_start from public.bookings where table_number = v_booking.table_number and date = v_booking.date and status = 'confirmed' and start_time > v_booking.end_time order by start_time limit 1;
  v_gap := case when v_next_start is null then null else extract(epoch from (v_next_start - v_booking.end_time)) / 60 end;
  v_period := case when v_booking.end_time >= time '06:00' and v_booking.end_time < time '12:00' then 'morning' when v_booking.end_time >= time '12:00' and v_booking.end_time < time '16:00' then 'afternoon' else 'evening' end;
  select value -> v_period into v_rate from public.config where key = 'pricing_rates';
  v_amount := coalesce((v_rate ->> 'base')::integer, 0);
  return jsonb_build_object('available', v_next_start is null or v_gap >= 60, 'amount', v_amount, 'period', v_period, 'next_booking_start', v_next_start);
end; $$;

-- All Pilot/game tables are server-only. No client policies are intentionally granted.
alter table public.pilot_devices enable row level security;
alter table public.pilot_sessions enable row level security;
alter table public.welcome_lines enable row level security;
alter table public.game_sessions enable row level security;
alter table public.game_players enable row level security;
alter table public.game_frames enable row level security;
alter table public.score_events enable row level security;
alter table public.renewal_orders enable row level security;
alter table public.guest_join_requests enable row level security;

revoke all on function public.add_score_event(uuid,text,text,integer) from public, anon, authenticated;
revoke all on function public.undo_last_score_event(uuid) from public, anon, authenticated;
revoke all on function public.complete_frame(uuid,text) from public, anon, authenticated;
revoke all on function public.check_renewal_availability(uuid) from public, anon, authenticated;
grant execute on function public.add_score_event(uuid,text,text,integer) to service_role;
grant execute on function public.undo_last_score_event(uuid) to service_role;
grant execute on function public.complete_frame(uuid,text) to service_role;
grant execute on function public.check_renewal_availability(uuid) to service_role;
