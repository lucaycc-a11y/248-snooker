-- 248 Snooker — month-level date availability aggregation for the /book
-- calendar. Run in the Supabase SQL Editor for project wqmciwieiqvnswvspdyz.
-- Idempotent.
--
-- WHY: the /book calendar currently lets every future date be tapped, even
-- when every table/hour that day is already booked/locked — the client only
-- discovers this after drilling into the day. get_fully_booked_dates() lets
-- the calendar grey out those dates up front with ONE query per month view
-- instead of 30 client-side per-day checks.
--
-- Operating hours are hardcoded 0-24, matching the `site` config seed
-- (openHour:0, closeHour:24 in 0001_pages_foundation.sql) — the authoritative
-- source, not book/page.tsx's stale display-only CONFIG.openHour:6.

create or replace function public.get_fully_booked_dates(p_month date)
returns setof date
language sql
security definer
set search_path = public
stable
as $$
  with month_days as (
    select generate_series(
      date_trunc('month', p_month)::date,
      (date_trunc('month', p_month) + interval '1 month - 1 day')::date,
      interval '1 day'
    )::date as d
  ),
  grid as (
    select d, h, tn
    from month_days, generate_series(0, 23) h, unnest(array[1, 2]) tn
  ),
  covered as (
    select g.d, g.h, g.tn
    from grid g
    where exists (
      select 1 from public.slots s
      where s.table_number = g.tn
        and s.date between (g.d - 1) and (g.d + 1)
        and (s.status = 'booked' or (s.status = 'locked' and s.locked_until > now()))
        and (s.date + s.start_time) <= (g.d + (g.h || ' hours')::interval)
        and (s.date + s.start_time + (s.duration_hours || ' hours')::interval) > (g.d + (g.h || ' hours')::interval)
    )
  )
  select md.d from month_days md
  where not exists (
    select 1 from grid g
    where g.d = md.d
      and not exists (select 1 from covered c where c.d = g.d and c.h = g.h and c.tn = g.tn)
  );
$$;

revoke all on function public.get_fully_booked_dates(date) from public, anon, authenticated;
grant execute on function public.get_fully_booked_dates(date) to service_role;
