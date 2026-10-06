-- Part C: account deletion = immediate deactivation, personal data purged after 180 days.
-- Replaces the immediate anonymise RPC request_member_data_deletion(p_forfeit_wallet).
-- Every RPC here is service_role only: route handlers verify the session, then pass
-- the user id. A browser can never call these directly with its own JWT.

-- ════════════════════════════════════════════════════════════════════
-- § 1. Soft-delete state on public.users
-- ════════════════════════════════════════════════════════════════════
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS scheduled_purge_at timestamptz,
  ADD COLUMN IF NOT EXISTS purged_at timestamptz,
  ADD COLUMN IF NOT EXISTS restore_notice_pending boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS users_scheduled_purge_idx
  ON public.users (scheduled_purge_at)
  WHERE is_deleted AND purged_at IS NULL;

-- data_deletion_requests: soft_delete method; pending → restored | completed
ALTER TABLE public.data_deletion_requests DROP CONSTRAINT IF EXISTS data_deletion_requests_method_check;
ALTER TABLE public.data_deletion_requests ADD CONSTRAINT data_deletion_requests_method_check
  CHECK (method IN ('anonymize', 'hard_delete', 'soft_delete'));
ALTER TABLE public.data_deletion_requests DROP CONSTRAINT IF EXISTS data_deletion_requests_status_check;
ALTER TABLE public.data_deletion_requests ADD CONSTRAINT data_deletion_requests_status_check
  CHECK (status IN ('pending', 'completed', 'failed', 'restored'));

-- ════════════════════════════════════════════════════════════════════
-- § 2. Server-side pepper (vault) + HMAC helpers
-- ════════════════════════════════════════════════════════════════════
-- PREREQUISITE (created manually by the project owner, not by this migration):
--   vault secret named 'identity_hash_pepper' (32 random bytes, hex).
-- identity_pepper() raises 'identity_pepper_missing' until it exists, so codes
-- and identity hashes fail closed rather than falling back to plain SHA.

CREATE OR REPLACE FUNCTION public.identity_pepper()
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v text;
BEGIN
  SELECT decrypted_secret INTO v FROM vault.decrypted_secrets WHERE name = 'identity_hash_pepper';
  IF v IS NULL OR v = '' THEN RAISE EXCEPTION 'identity_pepper_missing'; END IF;
  RETURN v;
END $$;

-- Same normalisation as before (Gmail dots/+tag, lowercase), phone now E.164,
-- digest is HMAC-SHA256 with the vault pepper instead of plain SHA-256.
-- Table was empty when this changed, so no rehash is needed.
CREATE OR REPLACE FUNCTION public.hash_identity(p_kind text, p_value text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT encode(extensions.hmac(convert_to(
    CASE p_kind
      WHEN 'email' THEN (
        SELECT CASE
                 WHEN dom IN ('gmail.com', 'googlemail.com') THEN replace(split_part(loc, '+', 1), '.', '') || '@gmail.com'
                 ELSE split_part(loc, '+', 1) || '@' || dom
               END
          FROM (SELECT split_part(lower(btrim(coalesce(p_value, ''))), '@', 1) AS loc,
                       split_part(lower(btrim(coalesce(p_value, ''))), '@', 2) AS dom) x)
      WHEN 'phone' THEN (
        SELECT '+' || CASE WHEN length(d) = 8 THEN '852' || d ELSE d END
          FROM (SELECT regexp_replace(regexp_replace(coalesce(p_value, ''), '[^0-9]', '', 'g'), '^00', '') AS d) x)
      ELSE btrim(coalesce(p_value, ''))
    END, 'UTF8'), convert_to(public.identity_pepper(), 'UTF8'), 'sha256'), 'hex');
$$;

-- Called by the signup triggers on auth.users / auth.identities. Only hash when
-- there is something to compare against, so a missing pepper can never block
-- ordinary sign-ups while the table is empty.
CREATE OR REPLACE FUNCTION public.is_identity_reserved(p_kind text, p_value text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.deleted_account_identities WHERE kind = p_kind AND purge_after > now()) THEN
    RETURN false;
  END IF;
  RETURN EXISTS (SELECT 1 FROM public.deleted_account_identities
                  WHERE kind = p_kind AND purge_after > now()
                    AND identifier_hash = public.hash_identity(p_kind, p_value));
END $$;

CREATE OR REPLACE FUNCTION public.account_code_hash(p_code text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT encode(extensions.hmac(convert_to(btrim(coalesce(p_code, '')), 'UTF8'),
                                convert_to(public.identity_pepper(), 'UTF8'), 'sha256'), 'hex');
$$;

-- ════════════════════════════════════════════════════════════════════
-- § 3. One-time codes for account actions (no client access at all)
-- ════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.account_action_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  purpose text NOT NULL CHECK (purpose IN ('account_delete')),
  code_hash text NOT NULL,
  recipient_email text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS account_action_codes_user_idx
  ON public.account_action_codes (user_id, purpose, created_at DESC);
ALTER TABLE public.account_action_codes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.account_action_codes FROM anon, authenticated;

-- ════════════════════════════════════════════════════════════════════
-- § 4. "Activated booking" = paid and not yet finished (HK time)
--   confirmed and ends in the future (overnight end_time <= start_time handled),
--   or payment_review (money taken, outcome pending).
--   pending / payment_failed are NOT activated: they get cancelled on deletion.
-- ════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.user_has_activated_booking(p_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH n AS (SELECT (now() AT TIME ZONE 'Asia/Hong_Kong') AS t)
  SELECT EXISTS (
    SELECT 1 FROM public.bookings b, n
     WHERE b.user_id = p_user
       AND ( b.status = 'payment_review'
          OR (b.status = 'confirmed' AND (
                b.date > n.t::date
             OR (b.date = n.t::date AND (b.end_time > n.t::time OR b.end_time <= b.start_time))
             OR (b.date = n.t::date - 1 AND b.end_time <= b.start_time AND b.end_time > n.t::time))))
  );
$$;

CREATE OR REPLACE FUNCTION public.user_is_active_admin(p_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.admin_users
                  WHERE user_id = p_user AND is_active IS NOT FALSE);
$$;

-- ════════════════════════════════════════════════════════════════════
-- § 5. Step 1: issue a deletion code.
--   The caller generates the 6-digit code and sends it; this RPC stores only the
--   HMAC and returns the recipient read from public.users (never from the client).
-- ════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.account_delete_issue_code(p_user uuid, p_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_email text;
  v_deleted boolean;
  v_last timestamptz;
  v_hour int;
BEGIN
  SELECT email, is_deleted INTO v_email, v_deleted FROM public.users WHERE id = p_user FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'code', 'user_not_found'); END IF;
  IF v_deleted THEN RETURN jsonb_build_object('ok', false, 'code', 'already_deleted'); END IF;
  IF public.user_is_active_admin(p_user) THEN RETURN jsonb_build_object('ok', false, 'code', 'admin_account'); END IF;
  IF public.user_has_activated_booking(p_user) THEN RETURN jsonb_build_object('ok', false, 'code', 'active_bookings'); END IF;
  IF v_email IS NULL OR btrim(v_email) = '' THEN RETURN jsonb_build_object('ok', false, 'code', 'no_email'); END IF;
  IF p_code !~ '^[0-9]{6}$' THEN RAISE EXCEPTION 'invalid_code_format'; END IF;

  SELECT max(created_at), count(*) FILTER (WHERE created_at > now() - interval '1 hour')
    INTO v_last, v_hour
    FROM public.account_action_codes WHERE user_id = p_user AND purpose = 'account_delete';
  IF v_last > now() - interval '60 seconds' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'cooldown',
      'retry_after', ceil(extract(epoch FROM (v_last + interval '60 seconds' - now())))::int);
  END IF;
  IF v_hour >= 3 THEN RETURN jsonb_build_object('ok', false, 'code', 'rate_limited'); END IF;

  -- only the newest code is valid
  UPDATE public.account_action_codes SET consumed_at = now()
   WHERE user_id = p_user AND purpose = 'account_delete' AND consumed_at IS NULL;
  INSERT INTO public.account_action_codes (user_id, purpose, code_hash, recipient_email, expires_at)
  VALUES (p_user, 'account_delete', public.account_code_hash(p_code), v_email, now() + interval '10 minutes');

  RETURN jsonb_build_object('ok', true, 'email', v_email, 'expires_in', 600);
END $$;

-- ════════════════════════════════════════════════════════════════════
-- § 6. Step 2: verify code and deactivate, all in this one transaction.
-- ════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.account_delete_confirm(p_user uuid, p_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_u public.users%rowtype;
  v_c public.account_action_codes%rowtype;
  v_b record;
  v_cancelled int := 0;
  v_res jsonb;
  v_purge timestamptz;
BEGIN
  -- lock order everywhere: users row first
  SELECT * INTO v_u FROM public.users WHERE id = p_user FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'code', 'user_not_found'); END IF;
  IF v_u.is_deleted THEN RETURN jsonb_build_object('ok', false, 'code', 'already_deleted'); END IF;

  SELECT * INTO v_c FROM public.account_action_codes
   WHERE user_id = p_user AND purpose = 'account_delete' AND consumed_at IS NULL
   ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'code', 'code_invalid'); END IF;
  IF v_c.expires_at <= now() THEN RETURN jsonb_build_object('ok', false, 'code', 'code_expired'); END IF;
  IF v_c.attempts >= v_c.max_attempts THEN RETURN jsonb_build_object('ok', false, 'code', 'too_many_attempts'); END IF;

  IF public.account_code_hash(p_code) <> v_c.code_hash THEN
    UPDATE public.account_action_codes SET attempts = attempts + 1,
           consumed_at = CASE WHEN attempts + 1 >= max_attempts THEN now() END
     WHERE id = v_c.id;
    IF v_c.attempts + 1 >= v_c.max_attempts THEN
      RETURN jsonb_build_object('ok', false, 'code', 'too_many_attempts');
    END IF;
    RETURN jsonb_build_object('ok', false, 'code', 'code_wrong', 'remaining', v_c.max_attempts - v_c.attempts - 1);
  END IF;
  UPDATE public.account_action_codes SET consumed_at = now() WHERE id = v_c.id;

  -- re-check the blocks inside the transaction
  IF public.user_is_active_admin(p_user) THEN RETURN jsonb_build_object('ok', false, 'code', 'admin_account'); END IF;
  IF public.user_has_activated_booking(p_user) THEN RETURN jsonb_build_object('ok', false, 'code', 'active_bookings'); END IF;

  -- cancel unfinished (unpaid) bookings through the existing cancel path
  FOR v_b IN
    SELECT DISTINCT ON (coalesce(order_group_id, id)) id FROM public.bookings
     WHERE user_id = p_user AND status IN ('pending', 'payment_failed')
  LOOP
    v_res := public.cancel_pending_booking(v_b.id, p_user);
    IF (v_res->>'success')::boolean THEN v_cancelled := v_cancelled + coalesce((v_res->>'cancelled_count')::int, 0); END IF;
  END LOOP;

  -- release anything still held (credit / promo holds) so nothing is reserved while deleted
  UPDATE public.credit_holds SET status = 'released', released_at = now() WHERE user_id = p_user AND status = 'held';
  UPDATE public.promo_code_usages SET status = 'released', released_at = now() WHERE user_id = p_user AND status = 'held';

  -- deactivate. Points, wallet credits, coupons and member_code are left untouched (= frozen):
  -- every way to use them needs a signed-in session, and any new session restores the account first.
  v_purge := now() + interval '180 days';
  UPDATE public.users
     SET is_deleted = true, deleted_at = now(), scheduled_purge_at = v_purge,
         purged_at = NULL, restore_notice_pending = false, updated_at = now()
   WHERE id = p_user;

  INSERT INTO public.data_deletion_requests (user_id, status, method, metadata)
  VALUES (p_user, 'pending', 'soft_delete',
          jsonb_build_object('cancelled_bookings', v_cancelled, 'scheduled_purge_at', v_purge));

  -- global sign-out
  DELETE FROM auth.sessions WHERE user_id = p_user;
  DELETE FROM auth.refresh_tokens WHERE user_id = p_user::text;

  RETURN jsonb_build_object('ok', true, 'email', v_u.email, 'scheduled_purge_at', v_purge,
                            'cancelled_bookings', v_cancelled);
END $$;

-- ════════════════════════════════════════════════════════════════════
-- § 7. Restore on sign-in. Fires on every new auth session (OAuth, OTP,
--   password, magic link), so no sign-in path can skip it. Locks the same
--   users row as the purge job, so a boundary login and the purge serialise.
-- ════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.restore_on_new_session()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_u public.users%rowtype;
BEGIN
  SELECT * INTO v_u FROM public.users WHERE id = NEW.user_id FOR UPDATE;
  IF NOT FOUND OR NOT v_u.is_deleted THEN RETURN NEW; END IF;

  IF v_u.purged_at IS NOT NULL OR v_u.scheduled_purge_at <= now() THEN
    -- past the deadline: refuse the sign-in rather than revive a due account
    RAISE EXCEPTION 'account_purged' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.users
     SET is_deleted = false, deleted_at = NULL, scheduled_purge_at = NULL,
         restore_notice_pending = true, updated_at = now()
   WHERE id = NEW.user_id;
  UPDATE public.data_deletion_requests
     SET status = 'restored', processed_at = now()
   WHERE user_id = NEW.user_id AND method = 'soft_delete' AND status = 'pending';
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS restore_soft_deleted_account ON auth.sessions;
CREATE TRIGGER restore_soft_deleted_account
  AFTER INSERT ON auth.sessions
  FOR EACH ROW EXECUTE FUNCTION public.restore_on_new_session();

-- One-shot read of the welcome-back flag (route sends the 帳戶已恢復 email).
CREATE OR REPLACE FUNCTION public.account_take_restore_notice(p_user uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_email text;
BEGIN
  UPDATE public.users SET restore_notice_pending = false
   WHERE id = p_user AND restore_notice_pending
   RETURNING email INTO v_email;
  RETURN jsonb_build_object('restored', FOUND, 'email', v_email);
END $$;

-- ════════════════════════════════════════════════════════════════════
-- § 8. Daily purge. Batch ≤ 50, FOR UPDATE SKIP LOCKED, idempotent,
--   dry-run, optional single-user filter (for testing on one account).
--
--   KEPT (legal / accounting retention, linked only to the anonymous tombstone):
--     bookings, payment_attempts, cancellation_log, credits_ledger,
--     notification_log rows that reference a booking, locker_bookings in the past.
--   The auth.users row is scrambled + banned, NOT deleted: bookings,
--   payment_attempts and points_ledger reference it ON DELETE CASCADE, so a
--   real delete would wipe the retained records.
-- ════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.purge_due_deleted_accounts(p_dry_run boolean DEFAULT true, p_only_user uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_u public.users%rowtype;
  v_ok int := 0;
  v_failed int := 0;
  v_due int := 0;
  v_ids uuid[] := '{}';
BEGIN
  FOR v_u IN
    SELECT * FROM public.users
     WHERE is_deleted AND purged_at IS NULL AND scheduled_purge_at <= now()
       AND (p_only_user IS NULL OR id = p_only_user)
     ORDER BY scheduled_purge_at
     LIMIT 50
     FOR UPDATE SKIP LOCKED
  LOOP
    v_due := v_due + 1;
    IF p_dry_run THEN
      v_ids := v_ids || v_u.id;
      CONTINUE;
    END IF;

    BEGIN
      -- (a) HMAC identities BEFORE anonymising (email, phone, linked sign-ins)
      PERFORM public.record_deleted_identities(v_u.id);

      -- (b) money-like balances: clear through ledgers so balance = ledger sum
      IF coalesce(v_u.credits, 0) > 0 THEN
        PERFORM public.wallet_apply(v_u.id, -v_u.credits, 'manual', NULL, 'Account purged: wallet balance forfeited', NULL);
      END IF;
      DELETE FROM public.points_ledger WHERE user_id = v_u.id;

      -- (c) personal data
      DELETE FROM public.user_coupons WHERE user_id = v_u.id;
      DELETE FROM public.campaign_claims WHERE user_id = v_u.id;
      DELETE FROM public.referrals WHERE referrer_id = v_u.id OR referred_id = v_u.id;
      DELETE FROM public.admin_notifications WHERE user_id = v_u.id;          -- member inbox
      DELETE FROM public.notification_log WHERE user_id = v_u.id AND booking_id IS NULL;
      UPDATE public.notification_log SET device_token = NULL WHERE user_id = v_u.id;
      DELETE FROM public.auth_identities WHERE user_id = v_u.id;
      DELETE FROM public.phone_binding_events WHERE user_id = v_u.id;
      DELETE FROM public.account_change_requests WHERE user_id = v_u.id;
      DELETE FROM public.contact_change_requests WHERE user_id = v_u.id;
      DELETE FROM public.user_password_status WHERE user_id = v_u.id;
      DELETE FROM public.spark_conversations WHERE user_id = v_u.id;
      DELETE FROM public.spark_feedback WHERE user_id = v_u.id;
      DELETE FROM public.help_feedback WHERE user_id = v_u.id;
      DELETE FROM public.account_action_codes WHERE user_id = v_u.id;
      DELETE FROM public.locker_bookings WHERE user_id = v_u.id AND (end_time IS NULL OR end_time >= now());
      UPDATE public.account_change_audit SET old_value = NULL, new_value = NULL, request_ip = NULL, user_agent = NULL
       WHERE user_id = v_u.id;

      -- (d) tombstone profile
      UPDATE public.users
         SET email = NULL, phone = NULL, display_name = '已刪除用戶', avatar_url = NULL,
             date_of_birth = NULL, birthday_set = false, gender = NULL,
             member_qr_jwt = NULL, wallet_pass_id = NULL, member_code = NULL,
             email_verified_at = NULL, phone_verified_at = NULL, profile_complete = false,
             points = 0, points_converted = 0, tier = 'amateur', wallet_notify_opt_in = false,
             purged_at = now(), restore_notice_pending = false, updated_at = now()
       WHERE id = v_u.id;

      -- (e) login: scrambled, banned, every session / identity removed
      UPDATE auth.users
         SET email = 'deleted-' || v_u.id::text || '@deleted.invalid', phone = NULL,
             raw_user_meta_data = '{}'::jsonb, raw_app_meta_data = jsonb_build_object('deleted', true),
             banned_until = now() + interval '200 years', updated_at = now()
       WHERE id = v_u.id;
      DELETE FROM auth.identities WHERE user_id = v_u.id;
      DELETE FROM auth.sessions WHERE user_id = v_u.id;
      DELETE FROM auth.refresh_tokens WHERE user_id = v_u.id::text;
      DELETE FROM auth.mfa_factors WHERE user_id = v_u.id;
      DELETE FROM auth.one_time_tokens WHERE user_id = v_u.id;

      UPDATE public.data_deletion_requests SET status = 'completed', processed_at = now()
       WHERE user_id = v_u.id AND method = 'soft_delete' AND status = 'pending';
      v_ok := v_ok + 1;
    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed + 1;
      UPDATE public.data_deletion_requests SET error = left(SQLERRM, 500)
       WHERE user_id = v_u.id AND method = 'soft_delete' AND status = 'pending';
    END;
  END LOOP;

  IF NOT p_dry_run AND v_due > 0 THEN
    INSERT INTO public.audit_log (action, target_table, admin_email, after_value)
    VALUES ('account_purge_batch', 'users', 'system:purge_due_deleted_accounts',
            jsonb_build_object('due', v_due, 'purged', v_ok, 'failed', v_failed));
  END IF;

  RETURN jsonb_build_object('dry_run', p_dry_run, 'due', v_due, 'purged', v_ok, 'failed', v_failed,
                            'would_purge', CASE WHEN p_dry_run THEN to_jsonb(v_ids) END);
END $$;

-- ════════════════════════════════════════════════════════════════════
-- § 9. Retire the immediate-delete RPC, lock down grants, schedule purge
-- ════════════════════════════════════════════════════════════════════
DROP FUNCTION IF EXISTS public.request_member_data_deletion(boolean);
DROP FUNCTION IF EXISTS public.request_member_data_deletion();

REVOKE ALL ON FUNCTION public.identity_pepper() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hash_identity(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.account_code_hash(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.user_has_activated_booking(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.user_is_active_admin(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.account_delete_issue_code(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.account_delete_confirm(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.account_take_restore_notice(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.purge_due_deleted_accounts(boolean, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.restore_on_new_session() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.account_delete_issue_code(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.account_delete_confirm(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.account_take_restore_notice(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.purge_due_deleted_accounts(boolean, uuid) TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge-due-deleted-accounts') THEN
    PERFORM cron.unschedule('purge-due-deleted-accounts');
  END IF;
  PERFORM cron.schedule('purge-due-deleted-accounts', '47 19 * * *',
    'select public.purge_due_deleted_accounts(false);');
END $$;
