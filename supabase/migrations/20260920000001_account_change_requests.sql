-- Account change request system for secure phone/password changes
-- Implements email-link verification + OTP for phone changes

-- Table to store change request tokens (hashed)
CREATE TABLE IF NOT EXISTS public.account_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  purpose text NOT NULL CHECK (purpose IN ('password', 'phone')),
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  request_ip text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for performance and cleanup
CREATE INDEX IF NOT EXISTS account_change_requests_user_purpose_idx
  ON public.account_change_requests(user_id, purpose);
CREATE INDEX IF NOT EXISTS account_change_requests_token_hash_idx
  ON public.account_change_requests(token_hash) WHERE used_at IS NULL;
CREATE INDEX IF NOT EXISTS account_change_requests_expires_at_idx
  ON public.account_change_requests(expires_at) WHERE used_at IS NULL;

-- Audit log for change requests
CREATE TABLE IF NOT EXISTS public.account_change_audit (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('request_password_change', 'complete_password_change',
                                         'request_phone_change', 'complete_phone_change',
                                         'failed_token_validation')),
  request_id uuid REFERENCES public.account_change_requests(id) ON DELETE SET NULL,
  old_value text, -- hashed or redacted
  new_value text, -- hashed or redacted
  request_ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS account_change_audit_user_id_idx
  ON public.account_change_audit(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS account_change_audit_action_idx
  ON public.account_change_audit(action, created_at DESC);

-- Password setup tracking (for mandatory password gate)
CREATE TABLE IF NOT EXISTS public.user_password_status (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  password_set boolean NOT NULL DEFAULT false,
  password_set_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS: all tables are server-only
ALTER TABLE public.account_change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_change_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_password_status ENABLE ROW LEVEL SECURITY;

-- No client access
REVOKE ALL ON TABLE public.account_change_requests FROM public, anon, authenticated;
REVOKE ALL ON TABLE public.account_change_audit FROM public, anon, authenticated;
REVOKE ALL ON TABLE public.user_password_status FROM public, anon, authenticated;

-- Function to backfill password status for existing users
CREATE OR REPLACE FUNCTION public.backfill_password_status()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_password_status (user_id, password_set, password_set_at)
  SELECT
    id,
    (encrypted_password IS NOT NULL AND encrypted_password != '') as password_set,
    CASE
      WHEN encrypted_password IS NOT NULL AND encrypted_password != '' THEN created_at
      ELSE NULL
    END as password_set_at
  FROM auth.users
  ON CONFLICT (user_id) DO NOTHING;
END;
$$;

-- Run backfill
SELECT public.backfill_password_status();

-- Trigger to update password_status when password is set
CREATE OR REPLACE FUNCTION public.update_password_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.encrypted_password IS NOT NULL AND NEW.encrypted_password != '' THEN
    INSERT INTO public.user_password_status (user_id, password_set, password_set_at, updated_at)
    VALUES (NEW.id, true, now(), now())
    ON CONFLICT (user_id)
    DO UPDATE SET
      password_set = true,
      password_set_at = COALESCE(user_password_status.password_set_at, now()),
      updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_password_set ON auth.users;
CREATE TRIGGER on_auth_user_password_set
  AFTER INSERT OR UPDATE OF encrypted_password ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.update_password_status();

-- Cleanup function for expired tokens (run via cron or manual)
CREATE OR REPLACE FUNCTION public.cleanup_expired_change_requests()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.account_change_requests
  WHERE expires_at < now() - interval '7 days'
  AND used_at IS NULL;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

COMMENT ON TABLE public.account_change_requests IS
  'Stores hashed tokens for secure phone/password change requests. Tokens are single-use and expire after 30 minutes.';
COMMENT ON TABLE public.user_password_status IS
  'Tracks whether users have set a password. Used for mandatory password gate on login/signup.';
COMMENT ON FUNCTION public.cleanup_expired_change_requests() IS
  'Deletes expired change request tokens older than 7 days. Run periodically via cron.';
