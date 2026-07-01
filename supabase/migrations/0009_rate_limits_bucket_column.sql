-- 248 Snooker — rate_limits schema drift repair.
-- Run in the Supabase SQL Editor for project wqmciwieiqvnswvspdyz. Idempotent.
--
-- WHY:
--   The repo's canonical schema and code use `rate_limits.bucket`:
--     * 0003_booking_security_foundation.sql creates rate_limits(bucket, ...)
--     * check_rate_limit(...) inserts into bucket
--     * lib/rate-limit.ts passes p_bucket
--   Production drifted to a column named `action`, causing PostgreSQL 42703
--   errors when check_rate_limit tries to reference `bucket`.
--
-- DECISION:
--   Standardize on `bucket` (the repo's original design intent). `bucket` groups
--   a route family/action into a rate-limit bucket; the TS wrapper already uses it.

-- Normalize the production column name back to the repo's canonical `bucket`.
do $$
begin
  if exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'rate_limits'
       and column_name = 'action'
  ) and not exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'rate_limits'
       and column_name = 'bucket'
  ) then
    alter table public.rate_limits rename column action to bucket;
  end if;

  -- If a partial manual fix left both columns, keep canonical `bucket` and copy
  -- any missing values from `action` before dropping the drift column.
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'rate_limits' and column_name = 'action'
  ) and exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'rate_limits' and column_name = 'bucket'
  ) then
    update public.rate_limits
       set bucket = coalesce(bucket, action)
     where bucket is null and action is not null;
    alter table public.rate_limits drop column action;
  end if;
end $$;

-- Re-assert canonical constraints/indexes. Names may have drifted too, so use a
-- guarded drop/add around the primary key.
do $$
declare
  v_pk_name text;
begin
  select conname into v_pk_name
    from pg_constraint
   where conrelid = 'public.rate_limits'::regclass
     and contype = 'p'
   limit 1;

  if v_pk_name is not null then
    execute format('alter table public.rate_limits drop constraint %I', v_pk_name);
  end if;

  alter table public.rate_limits
    add constraint rate_limits_pkey primary key (bucket, identifier, window_start);
end $$;

create index if not exists rate_limits_cleanup_idx
  on public.rate_limits (window_start);

-- Recreate the function body to match canonical `bucket` naming exactly.
--
-- Two prior overloads may exist in a drifted production DB and must be removed
-- first (CREATE OR REPLACE cannot rename a parameter, and leaving stale overloads
-- makes named-arg RPC calls ambiguous):
--   * check_rate_limit(text, text, integer, integer) with the 3rd param named
--     `p_max` — the TS wrapper now sends `p_limit`, so the name must match.
--   * check_rate_limit(text, integer, integer) — a legacy 3-arg version with no
--     identifier param, now unused.
drop function if exists public.check_rate_limit(text, text, integer, integer);
drop function if exists public.check_rate_limit(text, integer, integer);

create function public.check_rate_limit(
  p_bucket text,
  p_identifier text,
  p_limit integer,
  p_window_seconds integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_start timestamptz;
  v_count integer;
begin
  if p_limit <= 0 then
    return false;
  end if;
  if p_window_seconds <= 0 then
    raise exception 'p_window_seconds must be positive';
  end if;

  v_window_start := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );

  insert into public.rate_limits (bucket, identifier, window_start, count)
  values (p_bucket, p_identifier, v_window_start, 1)
  on conflict (bucket, identifier, window_start)
  do update set count = public.rate_limits.count + 1
  returning count into v_count;

  -- Best-effort cleanup outside the active window.
  delete from public.rate_limits
   where window_start < now() - make_interval(secs => p_window_seconds * 2);

  return v_count <= p_limit;
end;
$$;

revoke all on function public.check_rate_limit(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.check_rate_limit(text, text, integer, integer) to service_role;
