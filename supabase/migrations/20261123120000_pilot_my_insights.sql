-- Space Pilot: Rival 對手紀錄 + 進步曲線 + 年度回顧（只讀，沿用 pilot_feature_state 內測閘）。
CREATE OR REPLACE FUNCTION public.pilot_my_insights(p_year integer DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
      join public.pilot_matches m on m.id = me.match_id and m.finished
      join public.pilot_match_players o on o.match_id = me.match_id and o.side <> me.side
      left join public.users u on u.id = o.user_id
     where me.user_id = auth.uid() and coalesce(u.display_name, o.guest_name) is not null
     group by coalesce(u.display_name, o.guest_name), o.user_id
     order by count(*) desc, max(m.started_at) desc
     limit 20
  ) r;

  select coalesce(jsonb_agg(x order by x.month), '[]'::jsonb) into v_monthly from (
    select extract(month from (m.started_at at time zone 'Asia/Hong_Kong'))::int as month,
           count(*) as matches, count(*) filter (where me.is_winner) as wins,
           round(100.0 * count(*) filter (where me.is_winner) / count(*)) as win_rate
      from public.pilot_match_players me
      join public.pilot_matches m on m.id = me.match_id and m.finished
     where me.user_id = auth.uid()
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

REVOKE ALL ON FUNCTION public.pilot_my_insights(integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.pilot_my_insights(integer) TO authenticated;
