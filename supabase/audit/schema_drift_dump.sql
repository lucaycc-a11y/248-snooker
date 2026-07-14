-- 248 Snooker — production schema drift dump.
-- Paste into Supabase SQL Editor for project wqmciwieiqvnswvspdyz and copy the
-- result grids back into the repo/PR.
--
-- Purpose:
--   Identify production schema/function/policy changes that exist live but are
--   missing from supabase/migrations/. Known suspected drift from the audit prompt:
--     * assign_member_code
--     * handle_new_user
--     * update_member_tier
--     * validate_member_code
--     * admin_users table / policies
--     * rate_limits.action vs repo's canonical rate_limits.bucket

-- 1) All public functions (definition + security mode + grants context).
select
  p.proname,
  pg_get_function_identity_arguments(p.oid) as args,
  p.prosecdef as security_definer,
  pg_get_function_result(p.oid) as returns,
  pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
order by p.proname, pg_get_function_identity_arguments(p.oid);

-- 2) Public function EXECUTE grants by role.
select
  p.proname,
  pg_get_function_identity_arguments(p.oid) as args,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_exec,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth_can_exec,
  has_function_privilege('service_role', p.oid, 'EXECUTE') as service_can_exec
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
order by p.proname, pg_get_function_identity_arguments(p.oid);

-- 3) Triggers (including auth.users triggers).
select
  t.tgname as trigger_name,
  ns.nspname as table_schema,
  c.relname as table_name,
  pg_get_triggerdef(t.oid, true) as trigger_definition
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace ns on ns.oid = c.relnamespace
where not t.tgisinternal
  and ns.nspname in ('public', 'auth')
order by ns.nspname, c.relname, t.tgname;

-- 4) Public table columns (compact schema dump).
select
  table_name,
  ordinal_position,
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
order by table_name, ordinal_position;

-- 5) RLS policies.
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

-- 6) Constraints.
select
  n.nspname as schema_name,
  c.relname as table_name,
  con.conname as constraint_name,
  con.contype as constraint_type,
  pg_get_constraintdef(con.oid, true) as definition
from pg_constraint con
join pg_class c on c.oid = con.conrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
order by c.relname, con.conname;

-- 7) Indexes.
select
  schemaname,
  tablename,
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
order by tablename, indexname;
