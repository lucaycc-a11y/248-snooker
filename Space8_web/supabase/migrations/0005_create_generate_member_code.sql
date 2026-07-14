-- 248 Snooker — restore the missing generate_member_code() helper.
-- Run in the Supabase SQL Editor for project wqmciwieiqvnswvspdyz (or via
-- `supabase db push`). Idempotent and ADDITIVE — CREATE OR REPLACE of a single
-- pure function; it does NOT drop or alter any trigger, table, or other function.
--
-- ── WHY ─────────────────────────────────────────────────────────────────────
-- Production auth logs show, on new-user creation:
--     ERROR: function generate_member_code() does not exist (SQLSTATE 42883)
--     500: Database error saving new user
-- The on_auth_user_created trigger (AFTER INSERT ON auth.users) assigns a member
-- code; that path calls generate_member_code(), which was never committed to the
-- repo (no migration ever created it — it was made directly in the dashboard and
-- lost). This migration restores it.
--
-- ⚠️ VERIFY THE TRIGGER TOPOLOGY FIRST (the maintainer must run this; the coding
-- assistant has no DB access). Google sign-in already creates real users through
-- the SAME trigger, which means the trigger itself works — so generate_member_code()
-- is almost certainly called INDIRECTLY by assign_member_code() (the SECURITY
-- DEFINER function you fixed), not by the trigger directly. Confirm with:
--
--   -- 1. Which of these functions exist in production?
--   select proname, pg_get_function_identity_arguments(oid) as args
--   from pg_proc
--   where proname in ('generate_member_code','assign_member_code',
--                     'validate_member_code','update_member_tier',
--                     'try_lock_slot','find_or_lock_slot','confirm_booking');
--
--   -- 2. What does the auth trigger actually call?
--   select tgname, pg_get_triggerdef(oid)
--   from pg_trigger
--   where tgrelid = 'auth.users'::regclass and not tgisinternal;
--
--   -- 3. Full body of assign_member_code (does it call generate_member_code()?)
--   select pg_get_functiondef(oid) from pg_proc where proname = 'assign_member_code';
--
-- If step 3 shows assign_member_code() calling generate_member_code(), this
-- migration is exactly the missing piece. If the trigger calls a DIFFERENT name,
-- this function is harmless (unused) and you've found the real culprit instead.

-- ════════════════════════════════════════════════════════════════════
-- generate_member_code() → '248-XXXX-XXXX-C'
--   * 8 payload chars + 1 Luhn-mod-32 check char.
--   * Alphabet is a clean 32 symbols: digits 2–9 and A–Z minus I and O — i.e.
--     0/1/I/O are excluded (the visually ambiguous set), which conveniently
--     leaves exactly 32 symbols so Luhn-mod-32 applies directly.
--   * Pure function (no table access) → no RLS / SECURITY DEFINER concern.
--   * Uniqueness: with 32^8 ≈ 1.1e12 payloads a collision is astronomically
--     unlikely; enforce hard uniqueness with a UNIQUE index on the storing
--     column (see the optional block at the bottom) and a caller retry if you
--     want a belt-and-braces guarantee.
-- ════════════════════════════════════════════════════════════════════
create or replace function public.generate_member_code()
returns text
language plpgsql
set search_path = public
as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; -- 32 symbols; no 0 1 I O
  n        constant int  := 32;
  payload  text := '';
  i        int;
  idx      int;
  factor   int := 2;   -- rightmost payload char weighted ×2 (Luhn)
  total    int := 0;
  addend   int;
  rem      int;
  chk      int;
begin
  -- 8 random payload characters.
  for i in 1..8 loop
    idx := floor(random() * n)::int;            -- 0..31
    payload := payload || substr(alphabet, idx + 1, 1);
  end loop;

  -- Luhn mod 32 over the payload, scanning right→left.
  for i in reverse 8..1 loop
    idx := position(substr(payload, i, 1) in alphabet) - 1;  -- 0-based code point
    addend := factor * idx;
    if addend >= n then
      addend := (addend / n) + (addend % n);     -- fold, like Luhn's "> 9 → digit sum"
    end if;
    total := total + addend;
    factor := case when factor = 2 then 1 else 2 end;
  end loop;

  rem := total % n;
  chk := (n - rem) % n;

  -- 248-XXXX-XXXX-C
  return '248-' || substr(payload, 1, 4) || '-' || substr(payload, 5, 4)
         || '-' || substr(alphabet, chk + 1, 1);
end;
$$;

-- ── Optional hard-uniqueness guard (uncomment if member codes are stored on a
-- column; replace <table>.<column> with the real target, e.g. users.member_code).
-- A partial/plain UNIQUE index makes a duplicate impossible even under the
-- vanishingly small collision odds; pair with a retry in assign_member_code().
--
--   create unique index if not exists <table>_member_code_uniq
--     on public.<table> (<column>) where <column> is not null;

-- ── Smoke test (optional): a few sample codes + a Luhn re-check sanity print.
--   select public.generate_member_code() from generate_series(1, 5);
