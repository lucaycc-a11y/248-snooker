-- Admin patrol: show who bound each iPad (and when / last seen / recording), and let an admin sign an iPad out remotely.
CREATE OR REPLACE FUNCTION public.pilot_admin_overview()
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
begin
  if auth.uid() is null or not public.is_active_admin() then raise exception 'NOT_ADMIN'; end if;
  return jsonb_build_object('server_time', now(), 'devices', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', d.id, 'room', d.room_name, 'table_number', d.table_number,
      'live', d.live, 'live_at', d.live_at,
      'booking_end', (select b.end_at from public.door_bookings_v b
                       where b.table_number = d.table_number and b.status = 'confirmed' and not b.is_test
                         and now() between b.start_at - interval '10 minutes' and b.end_at
                       order by b.start_at limit 1),
      'command_pending', d.command is not null,
      'bound_by_name', coalesce(u.display_name, a.email),
      'bound_at', d.created_at,
      'last_seen_at', d.last_seen_at,
      'recording', coalesce(d.recording, false)) order by d.table_number)
    from public.pilot_devices d
    left join public.users u on u.id = d.bound_by
    left join public.admin_users a on a.user_id = d.bound_by
    where d.revoked_at is null and d.last_seen_at > now() - interval '2 days'), '[]'::jsonb));
end $function$;

CREATE OR REPLACE FUNCTION public.pilot_admin_revoke_device(p_device uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
begin
  if auth.uid() is null or not public.is_active_admin() then raise exception 'NOT_ADMIN'; end if;
  update public.pilot_devices
     set revoked_at = now(), live = null, command = null
   where id = p_device and revoked_at is null;
  return jsonb_build_object('ok', found);
end $function$;

REVOKE ALL ON FUNCTION public.pilot_admin_revoke_device(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pilot_admin_revoke_device(uuid) TO authenticated;
