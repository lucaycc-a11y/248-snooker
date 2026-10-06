-- Part B1 — Lock phone/email changes: admin-only via WhatsApp support.
-- Members can no longer change their own phone or email (account-takeover risk,
-- new-member-offer farming). Changes go through admin_change_user_identity().
--
-- PREREQUISITE (run once, by Luca, in the SQL editor — never commit the value):
--   select vault.create_secret('<64+ random hex chars>', 'identity_hash_pepper');
-- The functions below fail closed if the secret is missing.
--
-- Idempotent. Functions live in `public` (hosted Supabase does not allow new
-- functions in the `auth` schema), same pattern as handle_new_user().

-- ════════════════════════════════════════════════════════════════════════════
-- 1. Hashing helpers (HMAC-SHA256 with a Vault pepper — plain SHA of an 8-digit
--    HK number is brute-forceable in seconds)
-- ════════════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Canonical form used for hashing only (never stored in clear).
--   phone: digits only, '+' stripped  (auth.users stores 85291234567, public.users +85291234567)
--   email: lowercase; gmail/googlemail → strip dots and +tag in local part
CREATE OR REPLACE FUNCTION public.identity_canonical(p_kind text, p_value text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v text := lower(btrim(coalesce(p_value, '')));
  v_local text;
  v_domain text;
BEGIN
  IF v = '' THEN RETURN NULL; END IF;
  IF p_kind = 'phone' THEN
    RETURN regexp_replace(v, '[^0-9]', '', 'g');
  ELSIF p_kind = 'email' THEN
    v_local := split_part(v, '@', 1);
    v_domain := split_part(v, '@', 2);
    IF v_domain IN ('gmail.com', 'googlemail.com') THEN
      v_local := replace(split_part(v_local, '+', 1), '.', '');
      v_domain := 'gmail.com';
    END IF;
    RETURN v_local || '@' || v_domain;
  END IF;
  RAISE EXCEPTION 'identity_canonical: unknown kind %', p_kind;
END;
$$;

CREATE OR REPLACE FUNCTION public.identity_hash(p_kind text, p_value text)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_pepper text;
  v_canon text := public.identity_canonical(p_kind, p_value);
BEGIN
  IF v_canon IS NULL THEN RETURN NULL; END IF;
  SELECT decrypted_secret INTO v_pepper
    FROM vault.decrypted_secrets WHERE name = 'identity_hash_pepper' LIMIT 1;
  IF v_pepper IS NULL OR length(v_pepper) < 32 THEN
    RAISE EXCEPTION 'identity_hash_pepper missing from vault';
  END IF;
  RETURN encode(extensions.hmac(p_kind || ':' || v_canon, v_pepper, 'sha256'), 'hex');
END;
$$;

-- Display mask for audit log + notice emails: +852 •••• 4212 / a•••@gmail.com
CREATE OR REPLACE FUNCTION public.identity_mask(p_kind text, p_value text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v text := btrim(coalesce(p_value, ''));
  d text;
BEGIN
  IF v = '' THEN RETURN NULL; END IF;
  IF p_kind = 'phone' THEN
    d := regexp_replace(v, '[^0-9]', '', 'g');
    IF d LIKE '852%' AND length(d) = 11 THEN
      RETURN '+852 •••• ' || right(d, 4);
    END IF;
    RETURN '+' || left(d, greatest(length(d) - 8, 1)) || ' •••• ' || right(d, 4);
  END IF;
  RETURN left(split_part(v, '@', 1), 1) || '•••@' || split_part(v, '@', 2);
END;
$$;

REVOKE ALL ON FUNCTION public.identity_mask(text, text) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.identity_canonical(text, text) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.identity_hash(text, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.identity_hash(text, text) TO service_role;

-- ════════════════════════════════════════════════════════════════════════════
-- 2. identity_change_history — sibling of deleted_account_identities.
--    Old AND new identifiers are hashed so an identifier that has ever been on
--    an account keeps counting as "used" for new-member eligibility.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.identity_change_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,              -- no FK: must survive account purge
  kind text NOT NULL CHECK (kind IN ('phone', 'email')),
  old_hash text,
  new_hash text NOT NULL,
  admin_user_id uuid NOT NULL,
  reason text NOT NULL,
  override_cooldown boolean NOT NULL DEFAULT false,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS identity_change_history_old_hash_idx
  ON public.identity_change_history (old_hash) WHERE old_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS identity_change_history_new_hash_idx
  ON public.identity_change_history (new_hash);
CREATE INDEX IF NOT EXISTS identity_change_history_user_idx
  ON public.identity_change_history (user_id, changed_at DESC);

ALTER TABLE public.identity_change_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.identity_change_history FROM public, anon, authenticated;

COMMENT ON TABLE public.identity_change_history IS
  'HMAC hashes (Vault pepper) of phone/email values replaced by admin_change_user_identity(). '
  'Old identifiers stay "used" for new-member eligibility. Service-role only.';

-- ════════════════════════════════════════════════════════════════════════════
-- 3. public.users guard — clients may not touch identity columns
-- ════════════════════════════════════════════════════════════════════════════
-- Column-level privileges: table-wide UPDATE is revoked, then re-granted only on
-- the self-editable profile columns (PersonalInfoTab + wallet-notify).
REVOKE UPDATE ON TABLE public.users FROM anon, authenticated;
GRANT UPDATE (display_name, gender, date_of_birth, avatar_url, wallet_notify_opt_in, updated_at)
  ON TABLE public.users TO authenticated;

-- Trigger: applies to every role (no role exemption — a postgres-owned
-- SECURITY DEFINER RPC callable by clients would otherwise bypass it).
--   empty → value          allowed (onboarding / OAuth / SMS first-time set)
--   value → NULL           allowed (account deletion anonymises to NULL)
--   value → other value    only inside admin_change_user_identity() (tx flag)
CREATE OR REPLACE FUNCTION public.guard_users_identity_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('app.identity_change_authorized', true) = 'on' THEN
    RETURN NEW;
  END IF;

  IF coalesce(OLD.phone, '') <> '' AND NEW.phone IS NOT NULL
     AND public.identity_canonical('phone', NEW.phone) IS DISTINCT FROM public.identity_canonical('phone', OLD.phone) THEN
    RAISE EXCEPTION 'identity_change_forbidden: phone' USING ERRCODE = '42501',
      HINT = 'Phone changes are admin-only (admin_change_user_identity).';
  END IF;

  IF coalesce(OLD.email, '') <> '' AND NEW.email IS NOT NULL
     AND lower(btrim(NEW.email)) IS DISTINCT FROM lower(btrim(OLD.email)) THEN
    RAISE EXCEPTION 'identity_change_forbidden: email' USING ERRCODE = '42501',
      HINT = 'Email changes are admin-only (admin_change_user_identity).';
  END IF;

  -- Clients may never clear the re-verify flag themselves.
  IF current_user IN ('anon', 'authenticated')
     AND OLD.needs_manual_phone_reverify AND NOT NEW.needs_manual_phone_reverify THEN
    RAISE EXCEPTION 'identity_change_forbidden: reverify flag' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_users_identity_columns ON public.users;
CREATE TRIGGER guard_users_identity_columns
  BEFORE UPDATE OF phone, email, needs_manual_phone_reverify ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.guard_users_identity_columns();

-- ════════════════════════════════════════════════════════════════════════════
-- 4. auth.users guard — blocks client auth.updateUser({ phone | email })
-- ════════════════════════════════════════════════════════════════════════════
-- GoTrue stages a requested change in phone_change / email_change and only
-- swaps it into phone / email after OTP confirmation, so both the staged and
-- the committed columns are checked. Rejected at the staging step, the user
-- gets an error from updateUser() and no OTP/email is sent.
--   Allowed: first-time value (old empty) — Google users adding a phone in
--   onboarding, SMS sign-up; same value re-sent; clearing a staged change;
--   confirmation timestamps, last_sign_in_at, tokens, metadata (columns not checked).
CREATE OR REPLACE FUNCTION public.guard_auth_users_identity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_phone text := public.identity_canonical('phone', OLD.phone);
  v_old_email text := lower(btrim(coalesce(OLD.email, '')));
BEGIN
  IF current_setting('app.identity_change_authorized', true) = 'on' THEN
    RETURN NEW;
  END IF;

  IF v_old_phone IS NOT NULL THEN
    IF public.identity_canonical('phone', NEW.phone) IS DISTINCT FROM v_old_phone
       AND NEW.phone IS NOT NULL THEN
      RAISE EXCEPTION 'identity_change_forbidden: phone' USING ERRCODE = '42501';
    END IF;
    IF coalesce(NEW.phone_change, '') <> ''
       AND public.identity_canonical('phone', NEW.phone_change) IS DISTINCT FROM v_old_phone THEN
      RAISE EXCEPTION 'identity_change_forbidden: phone' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF v_old_email <> '' THEN
    IF NEW.email IS NOT NULL AND lower(btrim(NEW.email)) <> v_old_email THEN
      RAISE EXCEPTION 'identity_change_forbidden: email' USING ERRCODE = '42501';
    END IF;
    IF coalesce(NEW.email_change, '') <> '' AND lower(btrim(NEW.email_change)) <> v_old_email THEN
      RAISE EXCEPTION 'identity_change_forbidden: email' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_auth_users_identity ON auth.users;
CREATE TRIGGER guard_auth_users_identity
  BEFORE UPDATE OF phone, phone_change, email, email_change ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.guard_auth_users_identity();

-- ════════════════════════════════════════════════════════════════════════════
-- 5. auth.identities guard — blocks manual linkIdentity() to a different email
-- ════════════════════════════════════════════════════════════════════════════
-- Automatic linking (Google sign-in with the same verified email) and first
-- sign-up keep working: the identity email equals the user's email, or the
-- user has no email yet. Linking a Google account with a DIFFERENT email onto
-- an existing account is rejected. INSERT only — sign-in refreshes of
-- identity_data are not touched.
CREATE OR REPLACE FUNCTION public.guard_auth_identities_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_email text;
  v_identity_email text := lower(btrim(coalesce(NEW.identity_data->>'email', '')));
BEGIN
  IF current_setting('app.identity_change_authorized', true) = 'on' THEN
    RETURN NEW;
  END IF;
  IF v_identity_email = '' OR NEW.provider IN ('phone', 'email') THEN
    RETURN NEW;
  END IF;

  SELECT lower(btrim(coalesce(email, ''))) INTO v_user_email FROM auth.users WHERE id = NEW.user_id;
  IF coalesce(v_user_email, '') <> '' AND v_user_email <> v_identity_email THEN
    RAISE EXCEPTION 'identity_change_forbidden: link' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_auth_identities_link ON auth.identities;
CREATE TRIGGER guard_auth_identities_link
  BEFORE INSERT ON auth.identities
  FOR EACH ROW EXECUTE FUNCTION public.guard_auth_identities_link();

REVOKE ALL ON FUNCTION public.guard_users_identity_columns() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_auth_users_identity() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_auth_identities_link() FROM public, anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 6. admin_change_user_identity — the ONLY path that changes phone/email
-- ════════════════════════════════════════════════════════════════════════════
-- service_role only. One identifier per call. Validation failures return
-- {success:false, code, message}; anything unexpected raises and the whole
-- transaction (auth.users + public.users + history + audit) rolls back.
-- p_admin_user_id = admin's auth user id (admin_users.user_id).
-- Points, credits, member_code, coupons, bookings and member QR are not touched.
CREATE OR REPLACE FUNCTION public.admin_change_user_identity(
  p_user_id uuid,
  p_new_phone text,
  p_new_email text,
  p_reason text,
  p_admin_user_id uuid,
  p_override boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_admin_email text;
  v_kind text;
  v_new text;
  v_old_phone text;
  v_old_email text;
  v_old text;
  v_old_hash text;
  v_new_hash text;
  v_last_change timestamptz;
  v_sessions integer := 0;
  v_now timestamptz := now();
BEGIN
  -- Defence in depth on top of the GRANT. current_user is the owner inside a
  -- SECURITY DEFINER body, so check the JWT role and the session login instead.
  -- Allowed: PostgREST with service_role JWT, or a direct postgres session (SQL editor).
  IF coalesce(auth.role(), '') <> 'service_role' AND session_user <> 'postgres' THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT email INTO v_admin_email FROM public.admin_users
   WHERE user_id = p_admin_user_id AND invite_status = 'active';
  IF v_admin_email IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'admin_not_active', 'message', 'Admin not active');
  END IF;

  IF p_reason IS NULL OR length(btrim(p_reason)) < 5 THEN
    RETURN jsonb_build_object('success', false, 'code', 'reason_required', 'message', 'Reason required (min 5 chars)');
  END IF;

  IF (coalesce(btrim(p_new_phone), '') <> '') = (coalesce(btrim(p_new_email), '') <> '') THEN
    RETURN jsonb_build_object('success', false, 'code', 'one_identifier', 'message', 'Provide exactly one of phone or email');
  END IF;

  IF coalesce(btrim(p_new_phone), '') <> '' THEN
    v_kind := 'phone';
    v_new := btrim(p_new_phone);
    IF v_new !~ '^\+[1-9][0-9]{7,14}$' THEN
      RETURN jsonb_build_object('success', false, 'code', 'invalid_phone', 'message', 'Phone must be E.164, e.g. +85291234567');
    END IF;
  ELSE
    v_kind := 'email';
    v_new := lower(btrim(p_new_email));
    IF v_new !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
      RETURN jsonb_build_object('success', false, 'code', 'invalid_email', 'message', 'Invalid email');
    END IF;
  END IF;

  -- Lock both rows for the rest of the transaction.
  PERFORM 1 FROM auth.users WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'user_not_found', 'message', 'User not found');
  END IF;
  SELECT phone, email INTO v_old_phone, v_old_email FROM public.users WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'user_not_found', 'message', 'Profile not found');
  END IF;

  v_old := CASE v_kind WHEN 'phone' THEN v_old_phone ELSE v_old_email END;
  IF public.identity_canonical(v_kind, v_old) IS NOT DISTINCT FROM public.identity_canonical(v_kind, v_new) THEN
    RETURN jsonb_build_object('success', false, 'code', 'unchanged', 'message', 'New value equals current value');
  END IF;

  -- Duplicate: any other account, committed or staged, in either table.
  IF v_kind = 'phone' THEN
    IF EXISTS (SELECT 1 FROM auth.users WHERE id <> p_user_id
                 AND (public.identity_canonical('phone', phone) = public.identity_canonical('phone', v_new)
                   OR public.identity_canonical('phone', phone_change) = public.identity_canonical('phone', v_new)))
       OR EXISTS (SELECT 1 FROM public.users WHERE id <> p_user_id
                 AND public.identity_canonical('phone', phone) = public.identity_canonical('phone', v_new)) THEN
      RETURN jsonb_build_object('success', false, 'code', 'in_use', 'message', 'Phone already used by another account');
    END IF;
  ELSE
    IF EXISTS (SELECT 1 FROM auth.users WHERE id <> p_user_id
                 AND (public.identity_canonical('email', email) = public.identity_canonical('email', v_new)
                   OR public.identity_canonical('email', email_change) = public.identity_canonical('email', v_new)))
       OR EXISTS (SELECT 1 FROM public.users WHERE id <> p_user_id
                 AND public.identity_canonical('email', email) = public.identity_canonical('email', v_new)) THEN
      RETURN jsonb_build_object('success', false, 'code', 'in_use', 'message', 'Email already used by another account');
    END IF;
  END IF;

  v_new_hash := public.identity_hash(v_kind, v_new);
  v_old_hash := public.identity_hash(v_kind, v_old);

  -- Previously used identifier (replaced on any account, or a deleted account).
  IF EXISTS (SELECT 1 FROM public.identity_change_history
              WHERE kind = v_kind AND (old_hash = v_new_hash OR new_hash = v_new_hash))
     OR EXISTS (SELECT 1 FROM public.deleted_account_identities WHERE identifier_hash = v_new_hash) THEN
    RETURN jsonb_build_object('success', false, 'code', 'previously_used', 'message', 'Identifier was used by another or deleted account');
  END IF;

  -- Cooldown: one change per account per 90 days.
  SELECT max(changed_at) INTO v_last_change FROM public.identity_change_history WHERE user_id = p_user_id;
  IF v_last_change IS NOT NULL AND v_last_change > v_now - interval '90 days' AND NOT p_override THEN
    RETURN jsonb_build_object('success', false, 'code', 'cooldown',
      'message', format('Last change %s; next allowed after %s (or use override)', v_last_change, v_last_change + interval '90 days'));
  END IF;

  PERFORM set_config('app.identity_change_authorized', 'on', true);

  IF v_kind = 'phone' THEN
    -- auth.users stores phone without '+'. Unconfirmed → next SMS login re-verifies.
    UPDATE auth.users
       SET phone = substr(v_new, 2), phone_confirmed_at = NULL,
           phone_change = '', phone_change_token = '', phone_change_sent_at = NULL,
           updated_at = v_now
     WHERE id = p_user_id;
    UPDATE auth.identities
       SET provider_id = substr(v_new, 2),
           identity_data = jsonb_set(identity_data, '{phone}', to_jsonb(substr(v_new, 2))),
           updated_at = v_now
     WHERE user_id = p_user_id AND provider = 'phone';
    -- phone_verified_at is kept: users_profile_complete_verified_chk requires it
    -- on complete profiles. Re-verification is carried by phone_confirmed_at
    -- (auth) + needs_manual_phone_reverify (profile).
    UPDATE public.users
       SET phone = v_new, needs_manual_phone_reverify = true, updated_at = v_now
     WHERE id = p_user_id;
  ELSE
    -- Admin has verified the customer through CS; email is marked confirmed so
    -- password / magic-link login keeps working.
    UPDATE auth.users
       SET email = v_new, email_confirmed_at = v_now,
           email_change = '', email_change_token_new = '', email_change_token_current = '',
           email_change_confirm_status = 0, email_change_sent_at = NULL,
           updated_at = v_now
     WHERE id = p_user_id;
    UPDATE auth.identities
       SET identity_data = jsonb_set(identity_data, '{email}', to_jsonb(v_new)),
           updated_at = v_now
     WHERE user_id = p_user_id AND provider = 'email';
    UPDATE public.users
       SET email = v_new, email_verified_at = v_now, updated_at = v_now
     WHERE id = p_user_id;
  END IF;

  -- Never leave auth.users and public.users out of sync.
  IF NOT EXISTS (
    SELECT 1 FROM auth.users a JOIN public.users u ON u.id = a.id
     WHERE a.id = p_user_id
       AND CASE v_kind
             WHEN 'phone' THEN public.identity_canonical('phone', a.phone) = public.identity_canonical('phone', u.phone)
             ELSE lower(a.email) = lower(u.email) END
  ) THEN
    RAISE EXCEPTION 'identity sync check failed for %', p_user_id;
  END IF;

  -- Revoke every session (refresh tokens go with them). Already-issued access
  -- JWTs remain valid until expiry (Auth setting, default 1h).
  DELETE FROM auth.refresh_tokens WHERE user_id = p_user_id::text;
  DELETE FROM auth.sessions WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_sessions = ROW_COUNT;

  INSERT INTO public.identity_change_history (user_id, kind, old_hash, new_hash, admin_user_id, reason, override_cooldown, changed_at)
  VALUES (p_user_id, v_kind, v_old_hash, v_new_hash, p_admin_user_id, btrim(p_reason),
          p_override AND v_last_change IS NOT NULL AND v_last_change > v_now - interval '90 days', v_now);

  INSERT INTO public.audit_log (admin_user_id, admin_email, action, target_table, target_id, before_value, after_value)
  VALUES (p_admin_user_id, v_admin_email, 'member_change_' || v_kind, 'users', p_user_id::text,
          jsonb_build_object(v_kind, public.identity_mask(v_kind, v_old)),
          jsonb_build_object(v_kind, public.identity_mask(v_kind, v_new),
                             'reason', btrim(p_reason), 'override', p_override,
                             'sessions_revoked', v_sessions));

  RETURN jsonb_build_object(
    'success', true,
    'kind', v_kind,
    'old_masked', public.identity_mask(v_kind, v_old),
    'new_masked', public.identity_mask(v_kind, v_new),
    'old_email', v_old_email,
    'new_email', CASE WHEN v_kind = 'email' THEN v_new ELSE NULL END,
    'sessions_revoked', v_sessions,
    'changed_at', v_now
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_change_user_identity(uuid, text, text, text, uuid, boolean) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_change_user_identity(uuid, text, text, text, uuid, boolean) TO service_role;
