-- SPACE8 — rebrand member codes from planet names to tier abbreviations.
-- Format: SPACE8-{TIER}-{4chars}-{check}, where TIER ∈ {AMA, CEN, MAX}.
--   AMA = amateur, CEN = century, MAX = maximum.
--
-- ── APPLY MANUALLY ──────────────────────────────────────────────────────────
-- The coding assistant has NO Supabase access in this session; run this in the
-- SQL Editor (project wqmciwieiqvnswvspdyz) or via `supabase db push`.
--
-- ⚠️ CALL-SITE / OVERLOAD CAVEAT (must verify against prod before relying on it)
-- This defines generate_member_code(p_tier text DEFAULT 'amateur'). Postgres
-- treats that as a NEW overload — the pre-existing zero-arg generate_member_code()
-- (migration 0005, the legacy '248-XXXX-XXXX-C' format) is NOT replaced and still
-- resolves for callers that invoke it with no arguments. Before this takes effect
-- everywhere:
--   1. Enumerate real call sites in prod:
--        select tgname, pg_get_triggerdef(oid) from pg_trigger
--        where tgrelid = 'auth.users'::regclass and not tgisinternal;
--        select pg_get_functiondef(oid) from pg_proc
--        where proname in ('assign_member_code','handle_new_user');
--   2. Update each to pass a tier — e.g. generate_member_code(NEW.member_tier)
--      in a trigger, or generate_member_code('amateur') for new signups (who
--      always start Amateur).
--   3. If nothing should ever use the arg-less legacy form again, drop it:
--        drop function if exists public.generate_member_code();
--      (Only after confirming no trigger/RPC still calls the no-arg version.)
--
-- ⚠️ EXISTING MEMBERS: do NOT regenerate. The 39 planet-named codes already
-- issued (e.g. SPACE8-MARS-9DGQ-V) stay valid as legacy codes. This migration
-- only changes what NEW codes look like — it touches no existing rows.

CREATE OR REPLACE FUNCTION public.generate_member_code(p_tier text DEFAULT 'amateur')
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  tier_abbr text;
  part2 text := '';
  raw text;
  checksum integer := 0;
  check_char text;
  i integer;
  final_code text;
BEGIN
  tier_abbr := CASE lower(p_tier)
    WHEN 'century' THEN 'CEN'
    WHEN 'maximum' THEN 'MAX'
    ELSE 'AMA'
  END;

  FOR i IN 1..4 LOOP
    part2 := part2 || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;

  raw := tier_abbr || part2;
  FOR i IN 1..length(raw) LOOP
    checksum := checksum + ascii(substr(raw, i, 1)) * i;
  END LOOP;
  checksum := checksum % 36;
  IF checksum < 10 THEN
    check_char := checksum::text;
  ELSE
    check_char := chr(55 + checksum);
  END IF;

  final_code := 'SPACE8-' || tier_abbr || '-' || part2 || '-' || check_char;

  WHILE EXISTS (SELECT 1 FROM users WHERE member_code = final_code) LOOP
    part2 := '';
    FOR i IN 1..4 LOOP
      part2 := part2 || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    END LOOP;
    raw := tier_abbr || part2;
    checksum := 0;
    FOR i IN 1..length(raw) LOOP
      checksum := checksum + ascii(substr(raw, i, 1)) * i;
    END LOOP;
    checksum := checksum % 36;
    IF checksum < 10 THEN
      check_char := checksum::text;
    ELSE
      check_char := chr(55 + checksum);
    END IF;
    final_code := 'SPACE8-' || tier_abbr || '-' || part2 || '-' || check_char;
  END LOOP;

  RETURN final_code;
END;
$function$;
