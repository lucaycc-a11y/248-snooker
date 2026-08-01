-- 248 Snooker — admin invite RPC (Phase 2 of the /admin rebuild).
-- Run in the Supabase SQL Editor for project wqmciwieiqvnswvspdyz. Idempotent.
--
-- invite_admin() creates or refreshes a pending admin_users row with a 24h
-- token. Re-inviting an already-active admin is a deliberate no-op: the
-- WHERE clause on the upsert blocks the write, and the function verifies the
-- token it generated was actually persisted before claiming success — so it
-- never returns a token for a row that silently kept its old (active) state.

CREATE OR REPLACE FUNCTION public.invite_admin(
  p_email      text,
  p_role       text,
  p_invited_by uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token   text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  v_written boolean;
BEGIN
  IF p_role NOT IN ('admin', 'super_admin') THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_role');
  END IF;

  INSERT INTO public.admin_users (email, role, invited_by, invite_status, invite_token, invite_expires_at)
  VALUES (lower(p_email), p_role, p_invited_by, 'pending', v_token, now() + interval '24 hours')
  ON CONFLICT (email) DO UPDATE SET
    role              = excluded.role,
    invited_by        = excluded.invited_by,
    invite_status     = 'pending',
    invite_token      = excluded.invite_token,
    invite_expires_at = excluded.invite_expires_at
  WHERE public.admin_users.invite_status <> 'active';

  -- The WHERE clause above silently no-ops the write when the existing row is
  -- already active — confirm the token we generated actually landed before
  -- claiming success, rather than returning a token nobody can use.
  SELECT (invite_token = v_token) INTO v_written
    FROM public.admin_users WHERE email = lower(p_email);

  IF NOT coalesce(v_written, false) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'already_active');
  END IF;

  RETURN jsonb_build_object('success', true, 'token', v_token);
END;
$$;

REVOKE ALL ON FUNCTION public.invite_admin(text, text, uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.invite_admin(text, text, uuid) TO service_role;
