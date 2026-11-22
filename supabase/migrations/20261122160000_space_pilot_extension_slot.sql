-- The one-hour slot right after a running booking, for the pay-to-extend page (/extend).
-- (Already applied to the project as `space_pilot_stage6_extension_slot`.)
create or replace function public.pilot_extension_slot(p_booking_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare b public.door_bookings_v%rowtype; v_end timestamp; v_free boolean;
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select * into b from public.door_bookings_v where booking_id = p_booking_id;
  if b.booking_id is null or b.status <> 'confirmed' or b.is_test then
    return jsonb_build_object('status', 'NOT_FOUND');
  end if;
  if b.end_at <= now() - interval '10 minutes' then
    return jsonb_build_object('status', 'ENDED');
  end if;
  v_end := b.end_at at time zone 'Asia/Hong_Kong';
  if extract(minute from v_end) <> 0 or extract(second from v_end) <> 0 then
    return jsonb_build_object('status', 'NOT_ON_HOUR');
  end if;
  v_free := not exists (
    select 1 from public.door_bookings_v x
     where x.table_number = b.table_number and x.status = 'confirmed'
       and x.booking_id <> b.booking_id
       and x.start_at < b.end_at + interval '60 minutes' and x.end_at > b.end_at);
  return jsonb_build_object(
    'status', case when v_free then 'OK' else 'TAKEN' end,
    'table_number', b.table_number,
    'date', to_char(v_end, 'YYYY-MM-DD'),
    'start_hour', extract(hour from v_end)::int,
    'end_at', b.end_at);
end $$;
revoke execute on function public.pilot_extension_slot(uuid) from public, anon;
grant execute on function public.pilot_extension_slot(uuid) to authenticated;
