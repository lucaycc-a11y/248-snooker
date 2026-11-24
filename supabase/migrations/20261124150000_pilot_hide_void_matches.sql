-- Space Pilot: members can hide a match from their OWN record (reversible); admins can void a match
-- (removed from everyone's record). Hidden/voided matches are excluded from list, stats, insights and rotations.

ALTER TABLE public.pilot_match_players ADD COLUMN IF NOT EXISTS hidden boolean NOT NULL DEFAULT false;
ALTER TABLE public.pilot_matches ADD COLUMN IF NOT EXISTS voided_at timestamptz;
ALTER TABLE public.pilot_matches ADD COLUMN IF NOT EXISTS voided_by uuid;

CREATE OR REPLACE FUNCTION public.pilot_hide_match(p_match_id uuid, p_hidden boolean DEFAULT true)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
declare v_n int;
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
  update public.pilot_match_players set hidden = p_hidden
   where match_id = p_match_id and user_id = auth.uid();
  get diagnostics v_n = row_count;
  return jsonb_build_object('ok', v_n > 0);
end $$;

CREATE OR REPLACE FUNCTION public.pilot_unhide_all_matches()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
declare v_n int;
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
  update public.pilot_match_players set hidden = false where user_id = auth.uid() and hidden;
  get diagnostics v_n = row_count;
  return jsonb_build_object('ok', true, 'restored', v_n);
end $$;

CREATE OR REPLACE FUNCTION public.pilot_admin_void_match(p_match_id uuid, p_void boolean DEFAULT true)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
declare v_n int;
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not exists (select 1 from public.admin_users a where a.user_id = auth.uid() and a.is_active) then
    raise exception 'FORBIDDEN';
  end if;
  update public.pilot_matches
     set voided_at = case when p_void then now() else null end,
         voided_by = case when p_void then auth.uid() else null end
   where id = p_match_id;
  get diagnostics v_n = row_count;
  return jsonb_build_object('ok', v_n > 0);
end $$;

REVOKE ALL ON FUNCTION public.pilot_hide_match(uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.pilot_unhide_all_matches() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.pilot_admin_void_match(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pilot_hide_match(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pilot_unhide_all_matches() TO authenticated;
GRANT EXECUTE ON FUNCTION public.pilot_admin_void_match(uuid, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.pilot_my_matches(p_limit integer DEFAULT 20)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
declare v_state jsonb; v_rows jsonb; v_hidden int;
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
  v_state := public.pilot_feature_state();
  if not (v_state->>'enabled')::boolean then
    return jsonb_build_object('enabled', false, 'beta', true, 'matches', '[]'::jsonb);
  end if;
  select count(*) into v_hidden from public.pilot_match_players h
    join public.pilot_matches hm on hm.id = h.match_id and hm.voided_at is null
   where h.user_id = auth.uid() and h.hidden;
  select coalesce(jsonb_agg(r order by r.started_at desc), '[]'::jsonb) into v_rows from (
    select m.id, m.started_at, m.room_name, m.game, m.scoring, m.finished,
           me.side as my_side, me.score as my_score, me.is_winner as won,
           (select coalesce(sum(o.score) filter (where o.side <> me.side), 0) from public.pilot_match_players o where o.match_id = m.id) as opp_score,
           (select coalesce(jsonb_agg(coalesce(u.display_name, o.guest_name)), '[]'::jsonb)
              from public.pilot_match_players o left join public.users u on u.id = o.user_id
             where o.match_id = m.id and o.side <> me.side) as opponents
      from public.pilot_match_players me
      join public.pilot_matches m on m.id = me.match_id
     where me.user_id = auth.uid() and not me.hidden and m.voided_at is null
     order by m.started_at desc
     limit greatest(1, least(coalesce(p_limit,20), 100))
  ) r;
  return jsonb_build_object('enabled', true, 'beta', true, 'matches', v_rows, 'hidden_count', v_hidden);
end $function$;

CREATE OR REPLACE FUNCTION public.pilot_my_stats()
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
declare v_total int; v_wins int; v_streak int; v_opp jsonb;
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not (public.pilot_feature_state()->>'enabled')::boolean then
    return jsonb_build_object('enabled', false);
  end if;
  select count(*), count(*) filter (where p.is_winner) into v_total, v_wins
    from public.pilot_match_players p join public.pilot_matches m on m.id = p.match_id and m.finished and m.voided_at is null
   where p.user_id = auth.uid() and not p.hidden;
  select coalesce(max(c), 0) into v_streak from (
    select count(*) c from (
      select p.is_winner,
             row_number() over (order by m.started_at) - row_number() over (partition by p.is_winner order by m.started_at) grp
        from public.pilot_match_players p join public.pilot_matches m on m.id = p.match_id and m.finished and m.voided_at is null
       where p.user_id = auth.uid() and not p.hidden) s
     where is_winner group by grp) x;
  select jsonb_build_object('name', n, 'matches', c, 'my_wins', w) into v_opp from (
    select coalesce(u.display_name, o.guest_name) n, count(*) c, count(*) filter (where me.is_winner) w
      from public.pilot_match_players me
      join public.pilot_matches m on m.id = me.match_id and m.finished and m.voided_at is null
      join public.pilot_match_players o on o.match_id = me.match_id and o.side <> me.side
      left join public.users u on u.id = o.user_id
     where me.user_id = auth.uid() and not me.hidden and coalesce(u.display_name, o.guest_name) is not null
     group by coalesce(u.display_name, o.guest_name)
     order by c desc limit 1) t;
  return jsonb_build_object('enabled', true, 'matches', v_total, 'wins', v_wins,
    'win_rate', case when v_total = 0 then 0 else round(100.0 * v_wins / v_total) end,
    'longest_streak', v_streak, 'top_opponent', v_opp);
end $function$;

CREATE OR REPLACE FUNCTION public.pilot_my_insights(p_year integer DEFAULT NULL::integer)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
declare
  v_year int := coalesce(p_year, extract(year from (now() at time zone 'Asia/Hong_Kong'))::int);
  v_rivals jsonb; v_monthly jsonb; v_recap jsonb;
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not (public.pilot_feature_state()->>'enabled')::boolean then
    return jsonb_build_object('enabled', false);
  end if;

  select coalesce(jsonb_agg(r order by r.matches desc, r.last_played desc), '[]'::jsonb) into v_rivals from (
    select coalesce(u.display_name, o.guest_name) as name, o.user_id as user_id,
           count(*) as matches, count(*) filter (where me.is_winner) as my_wins,
           count(*) filter (where not me.is_winner) as their_wins,
           max(m.started_at) as last_played
      from public.pilot_match_players me
      join public.pilot_matches m on m.id = me.match_id and m.finished and m.voided_at is null
      join public.pilot_match_players o on o.match_id = me.match_id and o.side <> me.side
      left join public.users u on u.id = o.user_id
     where me.user_id = auth.uid() and not me.hidden and coalesce(u.display_name, o.guest_name) is not null
     group by coalesce(u.display_name, o.guest_name), o.user_id
     order by count(*) desc, max(m.started_at) desc
     limit 20
  ) r;

  select coalesce(jsonb_agg(x order by x.month), '[]'::jsonb) into v_monthly from (
    select extract(month from (m.started_at at time zone 'Asia/Hong_Kong'))::int as month,
           count(*) as matches, count(*) filter (where me.is_winner) as wins,
           round(100.0 * count(*) filter (where me.is_winner) / count(*)) as win_rate
      from public.pilot_match_players me
      join public.pilot_matches m on m.id = me.match_id and m.finished and m.voided_at is null
     where me.user_id = auth.uid() and not me.hidden
       and extract(year from (m.started_at at time zone 'Asia/Hong_Kong'))::int = v_year
     group by 1
  ) x;

  select jsonb_build_object(
      'year', v_year,
      'matches', coalesce(sum((e->>'matches')::int), 0),
      'wins', coalesce(sum((e->>'wins')::int), 0),
      'best_month', (select (e2->>'month')::int from jsonb_array_elements(v_monthly) e2
                      where (e2->>'matches')::int >= 3 order by (e2->>'win_rate')::numeric desc, (e2->>'matches')::int desc limit 1),
      'busiest_month', (select (e3->>'month')::int from jsonb_array_elements(v_monthly) e3
                         order by (e3->>'matches')::int desc limit 1),
      'top_rival', (select v_rivals->0)
    ) into v_recap
    from jsonb_array_elements(v_monthly) e;

  return jsonb_build_object('enabled', true, 'year', v_year, 'rivals', v_rivals, 'monthly', v_monthly,
                            'recap', coalesce(v_recap, jsonb_build_object('year', v_year, 'matches', 0, 'wins', 0)));
end $function$;

CREATE OR REPLACE FUNCTION public.pilot_my_rotations(p_limit integer DEFAULT 10)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
declare v_out jsonb;
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not (public.pilot_feature_state()->>'enabled')::boolean then
    return jsonb_build_object('enabled', false);
  end if;

  with mine as (
    select distinct m.payload->'rotation'->>'id' as rid
      from public.pilot_matches m
      join public.pilot_match_players me on me.match_id = m.id and me.user_id = auth.uid()
     where m.finished and m.voided_at is null and m.payload->'rotation'->>'id' is not null
  ), rot as (
    select m.payload->'rotation'->>'id' as rid,
           max(m.payload->'rotation'->>'style') as style,
           min(m.started_at) as started_at,
           max(m.room_name) as room_name
      from public.pilot_matches m
     where m.finished and m.voided_at is null and m.payload->'rotation'->>'id' in (select rid from mine)
     group by 1
     order by min(m.started_at) desc
     limit greatest(1, least(coalesce(p_limit, 10), 30))
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', rot.rid, 'style', rot.style, 'started_at', rot.started_at, 'room_name', rot.room_name,
      'matches', (
        select coalesce(jsonb_agg(jsonb_build_object(
            'id', m.id,
            'seq', case when m.payload->'rotation'->>'seq' ~ '^[0-9]+$' then (m.payload->'rotation'->>'seq')::int else 0 end,
            'started_at', m.started_at,
            'score_a', case when m.payload->>'scoreA' ~ '^[0-9]+$' then (m.payload->>'scoreA')::int else 0 end,
            'score_b', case when m.payload->>'scoreB' ~ '^[0-9]+$' then (m.payload->>'scoreB')::int else 0 end,
            'players', (
              select coalesce(jsonb_agg(jsonb_build_object(
                  'side', p.side, 'name', coalesce(u.display_name, p.guest_name), 'user_id', p.user_id,
                  'is_me', p.user_id = auth.uid(), 'score', p.score, 'is_winner', p.is_winner
                ) order by p.side, p.slot), '[]'::jsonb)
                from public.pilot_match_players p
                left join public.users u on u.id = p.user_id
               where p.match_id = m.id)
          ) order by m.started_at), '[]'::jsonb)
          from public.pilot_matches m
         where m.finished and m.voided_at is null and m.payload->'rotation'->>'id' = rot.rid
      )
    ) order by rot.started_at desc), '[]'::jsonb)
    into v_out
    from rot;

  return jsonb_build_object('enabled', true, 'rotations', v_out);
end $function$;
