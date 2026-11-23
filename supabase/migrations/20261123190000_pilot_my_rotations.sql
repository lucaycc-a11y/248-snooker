-- Space Pilot: 輪流賽（pilot_matches.payload.rotation）— 只讀，沿用 pilot_feature_state 內測閘。
CREATE OR REPLACE FUNCTION public.pilot_my_rotations(p_limit integer DEFAULT 10)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
     where m.finished and m.payload->'rotation'->>'id' is not null
  ), rot as (
    select m.payload->'rotation'->>'id' as rid,
           max(m.payload->'rotation'->>'style') as style,
           min(m.started_at) as started_at,
           max(m.room_name) as room_name
      from public.pilot_matches m
     where m.finished and m.payload->'rotation'->>'id' in (select rid from mine)
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
         where m.finished and m.payload->'rotation'->>'id' = rot.rid
      )
    ) order by rot.started_at desc), '[]'::jsonb)
    into v_out
    from rot;

  return jsonb_build_object('enabled', true, 'rotations', v_out);
end $function$;

REVOKE ALL ON FUNCTION public.pilot_my_rotations(integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.pilot_my_rotations(integer) TO authenticated;
