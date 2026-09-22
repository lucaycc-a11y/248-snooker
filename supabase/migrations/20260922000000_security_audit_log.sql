-- Security audit log: unified event logging for non-admin security events.
-- Captures: login attempts, password/phone changes, CSRF rejections, rate-limit
-- triggers, and other user-level security events.
--
-- CRITICAL: Never log secrets, tokens, OTPs, or plaintext passwords in any column.

CREATE TABLE IF NOT EXISTS public.security_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,  -- NULL for unauthenticated events (login failures, CSRF from anon)
  event_type text NOT NULL CHECK (event_type IN (
    'login_success',
    'login_failure',
    'password_change_request',
    'password_change_complete',
    'phone_change_request',
    'phone_change_complete',
    'csrf_rejection',
    'rate_limit_triggered',
    'session_created',
    'session_expired',
    'otp_sent',
    'otp_verification_failed',
    'otp_verification_success'
  )),
  ip_address text NOT NULL,
  user_agent text,
  target_resource text,  -- e.g. '/api/auth/login', 'booking:123', 'user:456'
  metadata jsonb,  -- Additional context (NEVER secrets/tokens/OTPs)
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS security_audit_log_user_idx
  ON public.security_audit_log (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS security_audit_log_event_idx
  ON public.security_audit_log (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS security_audit_log_ip_idx
  ON public.security_audit_log (ip_address, created_at DESC);
CREATE INDEX IF NOT EXISTS security_audit_log_created_idx
  ON public.security_audit_log (created_at DESC);

-- RLS: service_role only (events are written server-side)
ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;

-- No policies => only service_role can read/write
COMMENT ON TABLE public.security_audit_log IS
  'Security event audit log for user-level security events. Service-role only. NEVER log secrets, tokens, or OTPs.';

-- Cleanup function: prune events older than 90 days
CREATE OR REPLACE FUNCTION public.cleanup_security_audit_log()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.security_audit_log
   WHERE created_at < now() - interval '90 days';
END;
$$;

-- Add to existing cleanup cron job
DO $$
BEGIN
  -- Update existing cleanup job to also clean security_audit_log
  PERFORM cron.unschedule('cleanup-security-tables')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-security-tables');

  PERFORM cron.schedule(
    'cleanup-security-tables',
    '23 2 * * *',
    $$
      DELETE FROM public.rate_limits WHERE window_start < now() - interval '1 hour';
      DELETE FROM public.webhook_events WHERE status = 'processed' AND received_at < now() - interval '30 days';
      DELETE FROM public.security_audit_log WHERE created_at < now() - interval '90 days';
    $$
  );
END;
$$;

-- Refund rate limit function (missing from 0003 migration)
CREATE OR REPLACE FUNCTION public.refund_rate_limit(
  p_bucket text,
  p_identifier text,
  p_window_seconds integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_start timestamptz;
BEGIN
  v_window_start := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );

  UPDATE public.rate_limits
     SET count = GREATEST(0, count - 1)
   WHERE bucket = p_bucket
     AND identifier = p_identifier
     AND window_start = v_window_start;
END;
$$;

COMMENT ON FUNCTION public.refund_rate_limit IS
  'Refund a rate-limit attempt that did not consume the gated resource. Decrements counter by 1 (floor 0).';

REVOKE ALL ON FUNCTION public.refund_rate_limit(text, text, integer) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refund_rate_limit(text, text, integer) TO service_role;
