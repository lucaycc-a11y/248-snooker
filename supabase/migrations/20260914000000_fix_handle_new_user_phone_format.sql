-- Fix handle_new_user trigger to normalize phone to E.164 format
-- Prevents constraint violation on users_phone_e164_format when copying from auth.users

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_phone text;
BEGIN
  -- Normalize phone to E.164 format (add "+" prefix if missing)
  IF NEW.phone IS NOT NULL THEN
    IF NEW.phone LIKE '+%' THEN
      normalized_phone := NEW.phone;
    ELSE
      normalized_phone := '+' || NEW.phone;
    END IF;
  ELSE
    normalized_phone := NULL;
  END IF;

  -- Insert into public.users with normalized phone
  INSERT INTO public.users (id, email, phone, created_at)
  VALUES (
    NEW.id,
    NEW.email,
    normalized_phone,
    NOW()
  );

  RETURN NEW;
END;
$$;

-- Ensure trigger exists (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Comment for documentation
COMMENT ON FUNCTION public.handle_new_user() IS
  'Trigger function that creates a public.users record when auth.users is inserted. Normalizes phone to E.164 format by prepending + if missing.';
