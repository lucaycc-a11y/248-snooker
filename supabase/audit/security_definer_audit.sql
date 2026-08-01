-- 248 Snooker — SECURITY DEFINER permission audit.
-- Paste into Supabase SQL Editor for project wqmciwieiqvnswvspdyz.
--
-- Goal: list every public SECURITY DEFINER function and verify whether anon /
-- authenticated / service_role can EXECUTE it.
--
-- Policy used for evaluation:
--   * Money/payment/free/refund/points/slot mutation → service_role only.
--   * User-owned data operations → authenticated only, and function body must
--     enforce auth.uid() = row.user_id (never trust a passed user_id).
--   * Public read-only availability checks → anon may execute if the function
--     does not expose private user/payment data and has internal validation.
--   * Trigger-only functions → usually revoke direct anon/authenticated EXECUTE;
--     triggers run as the table owner, not as a direct client RPC.

-- 1) Required permission matrix from the task prompt.
select
  p.proname,
  pg_get_function_identity_arguments(p.oid) as args,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_exec,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth_can_exec,
  has_function_privilege('service_role', p.oid, 'EXECUTE') as service_can_exec,
  p.prosecdef as is_security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prosecdef = true
order by p.proname, pg_get_function_identity_arguments(p.oid);

-- 2) Function definitions for review. Copy/paste this result back into the PR
-- if any production-only function is absent from supabase/migrations/.
select
  p.proname,
  pg_get_function_identity_arguments(p.oid) as args,
  pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prosecdef = true
order by p.proname, pg_get_function_identity_arguments(p.oid);

-- 3) Trigger topology. Use this to identify SECURITY DEFINER functions that are
-- meant to be trigger-only (e.g. handle_new_user, assign_member_code).
select
  event_object_schema,
  event_object_table,
  trigger_name,
  action_timing,
  event_manipulation,
  action_statement
from information_schema.triggers
where action_statement ilike '%public.%'
   or action_statement ilike '%handle_new_user%'
   or action_statement ilike '%assign_member_code%'
   or action_statement ilike '%update_member_tier%'
order by event_object_schema, event_object_table, trigger_name;

-- 4) Repo-known functions — expected classification after migrations 0008–0010:
--
-- Function                         Expected direct execute
-- ───────────────────────────────  ─────────────────────────────────────────
-- apple_oauth_audit                service_role only (secrets/audit table)
-- apply_config_updated_at          trigger-only; revoke anon/auth if exposed
-- check_rate_limit                 service_role only (route handlers call it)
-- confirm_booking                  service_role only (money/payment/free/points)
-- find_or_lock_slot                service_role only (slot mutation + pricing path)
-- generate_member_code             service_role only; helper used by trigger/admin
-- release_expired_slot_locks       service_role only / pg_cron only
-- release_slot_lock                service_role only (slot mutation)
-- refund_booking                   service_role only (refund + points reversal)
-- update_pages_updated_at          trigger-only; revoke anon/auth if exposed
-- update_tier                      trigger-only; revoke anon/auth if exposed
--
-- Prompt-mentioned production-only functions to capture via query #2:
-- assign_member_code, handle_new_user, update_member_tier, validate_member_code.
-- Recommended default unless a real public use case is proven:
--   revoke execute from public, anon, authenticated;
--   grant execute to service_role;

-- 5) Optional hardening statements to apply ONLY after reviewing query #1/#2.
-- Keep these commented until confirmed against live output.
--
-- revoke all on function public.confirm_booking(uuid, text, text, text, text) from public, anon, authenticated;
-- grant execute on function public.confirm_booking(uuid, text, text, text, text) to service_role;
--
-- revoke all on function public.refund_booking(text, text) from public, anon, authenticated;
-- grant execute on function public.refund_booking(text, text) to service_role;
--
-- revoke all on function public.release_slot_lock(uuid, text) from public, anon, authenticated;
-- grant execute on function public.release_slot_lock(uuid, text) to service_role;
--
-- revoke all on function public.check_rate_limit(text, text, integer, integer) from public, anon, authenticated;
-- grant execute on function public.check_rate_limit(text, text, integer, integer) to service_role;
