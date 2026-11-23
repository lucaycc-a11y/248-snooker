-- Space Pilot clips: AI verdict (MiMo watches the clip), training-data flag, every-score caps.
alter table public.pilot_clips
  add column if not exists ai_potted boolean,
  add column if not exists ai_desc text,
  add column if not exists ai_checked_at timestamptz,
  add column if not exists train boolean not null default false;
create index if not exists pilot_clips_train_idx on public.pilot_clips(created_at) where train and deleted_at is null;

drop function if exists public.pilot_clip_register(text,text,text,text,integer,integer,jsonb,integer,text);

-- 每場上限 20 段、每日 120 段；訓練片（train）另計，總數上限 150 段，保存 180 日。
create or replace function public.pilot_clip_register(
  p_code text, p_kind text, p_label text, p_match_key text, p_score_a integer, p_score_b integer,
  p_players jsonb, p_duration_ms integer, p_ext text, p_train boolean default false)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare s public.pilot_cam_sessions%rowtype; d public.pilot_devices%rowtype; v_id uuid := gen_random_uuid();
        v_path text; v_tok text; v_ext text; v_train boolean := coalesce(p_train, false);
begin
  select * into s from public.pilot_cam_sessions where code = upper(coalesce(p_code, ''));
  if s.code is null or s.expires_at < now() then return jsonb_build_object('ok', false, 'error', 'BAD_CODE'); end if;
  select * into d from public.pilot_devices where id = s.device_id and revoked_at is null;
  if d.id is null then return jsonb_build_object('ok', false, 'error', 'BAD_DEVICE'); end if;
  if (select count(*) from public.pilot_clips where device_id = d.id and created_at > now() - interval '1 day') >= 120 then
    return jsonb_build_object('ok', false, 'error', 'DAILY_CAP');
  end if;
  if p_match_key is not null and (select count(*) from public.pilot_clips where device_id = d.id and match_key = p_match_key) >= 20 then
    return jsonb_build_object('ok', false, 'error', 'MATCH_CAP');
  end if;
  if v_train and (select count(*) from public.pilot_clips where train and deleted_at is null) >= 150 then
    v_train := false;  -- 訓練片已滿：照常上傳，但當普通片（24 小時後刪除）
  end if;
  v_ext := case when p_ext in ('mp4','webm','mov') then p_ext else 'mp4' end;
  v_path := d.id::text || '/' || to_char(now() at time zone 'utc', 'YYYYMM') || '/' || v_id::text || '.' || v_ext;
  insert into public.pilot_clips(id, device_id, room_name, match_key, kind, label, score_a, score_b, players, duration_ms, storage_path, train, expires_at)
  values (v_id, d.id, d.room_name, left(p_match_key, 60),
          case when p_kind in ('score','streak','key_ball','finish','manual') then p_kind else 'manual' end,
          left(p_label, 80), p_score_a, p_score_b,
          case when jsonb_typeof(p_players) = 'array' then p_players else '[]'::jsonb end,
          least(greatest(coalesce(p_duration_ms, 0), 0), 60000), v_path, v_train,
          case when v_train then now() + interval '180 days' else now() + interval '24 hours' end)
  returning share_token into v_tok;
  return jsonb_build_object('ok', true, 'id', v_id, 'path', v_path, 'share_token', v_tok, 'train', v_train);
end $$;

-- 手機頁驗證：呢條 path 係咪屬於呢個配對碼嘅裝置
create or replace function public.pilot_clip_for_verify(p_code text, p_path text)
returns jsonb language sql stable security definer set search_path to 'public' as $$
  select coalesce((
    select jsonb_build_object('ok', true, 'kind', c.kind, 'label', c.label, 'score_a', c.score_a, 'score_b', c.score_b)
      from public.pilot_clips c join public.pilot_cam_sessions s on s.device_id = c.device_id
     where s.code = upper(coalesce(p_code, '')) and s.expires_at > now()
       and c.storage_path = p_path and c.deleted_at is null and c.ai_checked_at is null
  ), jsonb_build_object('ok', false))
$$;

create or replace function public.pilot_clip_set_ai(p_path text, p_potted boolean, p_desc text)
returns boolean language plpgsql security definer set search_path to 'public' as $$
begin
  update public.pilot_clips set ai_potted = p_potted, ai_desc = left(p_desc, 200), ai_checked_at = now()
   where storage_path = p_path and deleted_at is null;
  return found;
end $$;

revoke all on function public.pilot_clip_register(text,text,text,text,integer,integer,jsonb,integer,text,boolean),
  public.pilot_clip_for_verify(text,text), public.pilot_clip_set_ai(text,boolean,text) from public, anon, authenticated;
grant execute on function public.pilot_clip_register(text,text,text,text,integer,integer,jsonb,integer,text,boolean),
  public.pilot_clip_for_verify(text,text), public.pilot_clip_set_ai(text,boolean,text) to service_role;
