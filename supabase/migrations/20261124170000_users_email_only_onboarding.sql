-- Space Pilot QR join: an account may exist with a verified email and no phone ('email_only').
-- It is NOT a complete profile: profile_complete stays false, so booking/payment (requireCompleteProfile)
-- and the signup bonus (granted only on 'complete') still wait for a phone verified by OTP.
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_onboarding_status_check;
ALTER TABLE public.users ADD CONSTRAINT users_onboarding_status_check
  CHECK (onboarding_status = ANY (ARRAY['pending_first_identity'::text, 'pending_second_identity'::text, 'email_only'::text, 'complete'::text]));

-- Read-only check of a Space Pilot join code (used by /api/profile/skip-phone, service role only).
CREATE OR REPLACE FUNCTION public.pilot_join_code_status(p_code text, p_user uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
declare r public.pilot_join_requests%rowtype;
begin
  select * into r from public.pilot_join_requests where code = upper(p_code);
  if r.code is null then return 'not_found'; end if;
  if r.expires_at < now() then return 'expired'; end if;
  if r.user_id is not null and r.user_id <> p_user then return 'already_used'; end if;
  return 'ok';
end $$;
REVOKE ALL ON FUNCTION public.pilot_join_code_status(text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pilot_join_code_status(text, uuid) TO service_role;
