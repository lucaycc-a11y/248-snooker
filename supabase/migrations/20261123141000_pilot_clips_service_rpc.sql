-- Service-role-only helpers for the Next.js routes (no direct table typing needed).
create or replace function public.pilot_clip_register(
  p_code text, p_kind text, p_label text, p_match_key text, p_score_a integer, p_score_b integer,
  p_players jsonb, p_duration_ms integer, p_ext text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare s public.pilot_cam_sessions%rowtype; d public.pilot_devices%rowtype; v_id uuid := gen_random_uuid(); v_path text; v_tok text; v_ext text;
begin
  select * into s from public.pilot_cam_sessions where code = upper(coalesce(p_code, ''));
  if s.code is null or s.expires_at < now() then return jsonb_build_object('ok', false, 'error', 'BAD_CODE'); end if;
  select * into d from public.pilot_devices where id = s.device_id and revoked_at is null;
  if d.id is null then return jsonb_build_object('ok', false, 'error', 'BAD_DEVICE'); end if;
  if (select count(*) from public.pilot_clips where device_id = d.id and created_at > now() - interval '1 day') >= 60 then
    return jsonb_build_object('ok', false, 'error', 'DAILY_CAP');
  end if;
  if p_match_key is not null and (select count(*) from public.pilot_clips where device_id = d.id and match_key = p_match_key) >= 6 then
    return jsonb_build_object('ok', false, 'error', 'MATCH_CAP');
  end if;
  v_ext := case when p_ext in ('mp4','webm','mov') then p_ext else 'mp4' end;
  v_path := d.id::text || '/' || to_char(now() at time zone 'utc', 'YYYYMM') || '/' || v_id::text || '.' || v_ext;
  insert into public.pilot_clips(id, device_id, room_name, match_key, kind, label, score_a, score_b, players, duration_ms, storage_path)
  values (v_id, d.id, d.room_name, left(p_match_key, 60),
          case when p_kind in ('score','streak','key_ball','finish','manual') then p_kind else 'manual' end,
          left(p_label, 80), p_score_a, p_score_b,
          case when jsonb_typeof(p_players) = 'array' then p_players else '[]'::jsonb end,
          least(greatest(coalesce(p_duration_ms, 0), 0), 60000), v_path)
  returning share_token into v_tok;
  return jsonb_build_object('ok', true, 'id', v_id, 'path', v_path, 'share_token', v_tok);
end $$;

create or replace function public.pilot_clip_public(p_token text)
returns jsonb language sql stable security definer set search_path to 'public' as $$
  select coalesce((select jsonb_build_object('found', true, 'path', c.storage_path, 'kind', c.kind, 'label', c.label,
           'room', c.room_name, 'score_a', c.score_a, 'score_b', c.score_b, 'players', c.players,
           'expires_at', c.expires_at, 'saved', c.saved)
      from public.pilot_clips c
     where c.share_token = p_token and c.deleted_at is null and c.expires_at > now()), jsonb_build_object('found', false))
$$;

create or replace function public.pilot_clips_due(p_limit integer default 200)
returns text[] language sql stable security definer set search_path to 'public' as $$
  select coalesce(array_agg(storage_path), '{}') from (
    select storage_path from public.pilot_clips where deleted_at is not null or expires_at < now() limit greatest(1, least(p_limit, 500))
  ) x
$$;

create or replace function public.pilot_clips_purge(p_paths text[])
returns integer language plpgsql security definer set search_path to 'public' as $$
declare n integer;
begin
  delete from public.pilot_clips where storage_path = any(p_paths) and (deleted_at is not null or expires_at < now());
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.pilot_clip_register(text,text,text,text,integer,integer,jsonb,integer,text),
  public.pilot_clip_public(text), public.pilot_clips_due(integer), public.pilot_clips_purge(text[]) from public, anon, authenticated;
grant execute on function public.pilot_clip_register(text,text,text,text,integer,integer,jsonb,integer,text),
  public.pilot_clip_public(text), public.pilot_clips_due(integer), public.pilot_clips_purge(text[]) to service_role;
