-- Fix handle_new_user trigger to ensure E.164 phone format
--
-- Problem: When auth.users.phone lacks the "+" prefix (e.g. "85256679798"),
-- the trigger copies it directly to public.users.phone, violating the
-- users_phone_e164_format CHECK constraint (which requires "+85256679798").
--
-- This caused new user registration to fail with:
--   new row for relation "users" violates check constraint "users_phone_e164_format"
--
-- Root cause: The original handle_new_user() did:
--   INSERT INTO public.users (..., phone, ...) VALUES (..., NEW.phone, ...)
-- without normalizing phone to E.164 format first.
--
-- Solution: Add "+" prefix if missing before writing to public.users.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone text;
BEGIN
  -- Normalize phone to E.164 format (must start with "+")
  IF NEW.phone IS NOT NULL THEN
    v_phone := NEW.phone;
    -- Add "+" prefix if missing
    IF v_phone !~ '^\+' THEN
      v_phone := '+' || v_phone;
    END IF;
  END IF;

  -- Insert new user into public.users with normalized phone
  INSERT INTO public.users (
    id,
    email,
    phone,
    display_name,
    avatar_url
  )
  VALUES (
    NEW.id,
    NEW.email,
    v_phone,  -- Use normalized phone instead of NEW.phone
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );

  RETURN NEW;
END;
$$;

-- Ensure trigger is properly bound (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

COMMENT ON FUNCTION public.handle_new_user() IS
  'Syncs auth.users to public.users. Normalizes phone to E.164 format (adds + prefix if missing) to satisfy users_phone_e164_format constraint.';
