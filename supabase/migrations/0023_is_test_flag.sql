alter table public.bookings add column if not exists is_test boolean not null default false;
create index if not exists bookings_is_test_idx on public.bookings (is_test) where is_test = true;

create or replace view public.admin_revenue_daily as
select
  date_trunc('day', date::timestamp) as day,
  sum(total_price) filter (where status = 'confirmed' and is_test = false) as revenue,
  count(*) filter (where status = 'confirmed' and is_test = false) as bookings
from public.bookings
group by 1
order by 1 desc;

revoke all on public.admin_revenue_daily from public, anon, authenticated;
grant select on public.admin_revenue_daily to service_role;
