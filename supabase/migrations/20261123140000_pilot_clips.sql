-- Space Pilot 精華影片（Phase 1）：手機鏡頭配對、clips 表、私人細容量 bucket。
-- 慳 Storage：單片 <= 12MB、只收 mp4/webm；未保存 24 小時過期，保存到「我的」30 日（由 cron 清理）。

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pilot-clips', 'pilot-clips', false, 12582912, array['video/mp4','video/webm','video/quicktime'])
on conflict (id) do update set public = false, file_size_limit = 12582912,
  allowed_mime_types = array['video/mp4','video/webm','video/quicktime'];

create table if not exists public.pilot_cam_sessions (
  code text primary key,
  device_id uuid not null references public.pilot_devices(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists pilot_cam_sessions_device_idx on public.pilot_cam_sessions(device_id);

create table if not exists public.pilot_clips (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.pilot_devices(id) on delete cascade,
  room_name text,
  match_key text,                     -- 同一場比賽嘅 clips 共用（開賽時間）
  kind text not null check (kind in ('score','streak','key_ball','finish','manual')),
  label text,
  score_a integer, score_b integer,
  players jsonb not null default '[]'::jsonb,
  storage_path text not null unique,
  size_bytes integer,
  duration_ms integer,
  share_token text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  owner_user_id uuid references public.users(id) on delete set null,
  saved boolean not null default false,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours',
  deleted_at timestamptz
);
create index if not exists pilot_clips_owner_idx on public.pilot_clips(owner_user_id) where deleted_at is null;
create index if not exists pilot_clips_expiry_idx on public.pilot_clips(expires_at);
alter table public.pilot_clips enable row level security;
alter table public.pilot_cam_sessions enable row level security;
-- 不開任何 policy：只經 SECURITY DEFINER RPC 或 service role 存取。

-- iPad：開（或沿用）手機鏡頭配對碼
create or replace function public.pilot_cam_open(p_token text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_dev uuid; v_code text; v_exp timestamptz;
begin
  v_dev := public.pilot_device_id(p_token);
  if v_dev is null then raise exception 'BAD_DEVICE'; end if;
  select code, expires_at into v_code, v_exp from public.pilot_cam_sessions
   where device_id = v_dev and expires_at > now() + interval '1 hour' order by created_at desc limit 1;
  if v_code is null then
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
    v_exp := now() + interval '12 hours';
    insert into public.pilot_cam_sessions(code, device_id, expires_at) values (v_code, v_dev, v_exp);
  end if;
  delete from public.pilot_cam_sessions where expires_at < now() - interval '1 day';
  return jsonb_build_object('code', v_code, 'expires_at', v_exp);
end $$;

-- 手機：用配對碼讀 iPad 現況（只有房間、比賽階段同比分）
create or replace function public.pilot_cam_status(p_code text)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare s public.pilot_cam_sessions%rowtype; d public.pilot_devices%rowtype;
begin
  select * into s from public.pilot_cam_sessions where code = upper(coalesce(p_code, ''));
  if s.code is null or s.expires_at < now() then return jsonb_build_object('ok', false); end if;
  select * into d from public.pilot_devices where id = s.device_id and revoked_at is null;
  if d.id is null then return jsonb_build_object('ok', false); end if;
  return jsonb_build_object('ok', true, 'room', d.room_name, 'live', coalesce(d.live, '{}'::jsonb),
                            'live_at', d.live_at, 'server_time', now());
end $$;

-- 會員：我的精華（只限管理員內測；其他人 enabled=false）
create or replace function public.pilot_my_clips(p_limit integer default 30)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare v_rows jsonb;
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not (public.pilot_feature_state()->>'enabled')::boolean then
    return jsonb_build_object('enabled', false, 'beta', true, 'clips', '[]'::jsonb);
  end if;
  select coalesce(jsonb_agg(r order by r.created_at desc), '[]'::jsonb) into v_rows from (
    select c.id, c.kind, c.label, c.room_name, c.score_a, c.score_b, c.players, c.duration_ms, c.size_bytes,
           c.created_at, c.expires_at, c.storage_path
      from public.pilot_clips c
     where c.owner_user_id = auth.uid() and c.saved and c.deleted_at is null and c.expires_at > now()
     order by c.created_at desc limit greatest(1, least(coalesce(p_limit, 30), 60))
  ) r;
  return jsonb_build_object('enabled', true, 'beta', true, 'clips', v_rows);
end $$;

-- 會員：掃 QR 後存入「我的」（保存 30 日）
create or replace function public.pilot_claim_clip(p_share_token text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare c public.pilot_clips%rowtype;
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not (public.pilot_feature_state()->>'enabled')::boolean then
    return jsonb_build_object('enabled', false);
  end if;
  update public.pilot_clips set owner_user_id = auth.uid(), saved = true,
         expires_at = greatest(expires_at, now() + interval '30 days')
   where share_token = p_share_token and deleted_at is null and expires_at > now()
     and (owner_user_id is null or owner_user_id = auth.uid())
   returning * into c;
  if c.id is null then return jsonb_build_object('enabled', true, 'saved', false); end if;
  return jsonb_build_object('enabled', true, 'saved', true, 'id', c.id);
end $$;

create or replace function public.pilot_delete_clip(p_id uuid)
returns boolean language plpgsql security definer set search_path to 'public' as $$
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
  update public.pilot_clips set deleted_at = now() where id = p_id and owner_user_id = auth.uid() and deleted_at is null;
  return found;
end $$;

revoke all on function public.pilot_cam_open(text), public.pilot_cam_status(text), public.pilot_my_clips(integer),
  public.pilot_claim_clip(text), public.pilot_delete_clip(uuid) from public;
grant execute on function public.pilot_cam_open(text), public.pilot_cam_status(text) to anon, authenticated;
grant execute on function public.pilot_my_clips(integer), public.pilot_claim_clip(text), public.pilot_delete_clip(uuid) to authenticated;
