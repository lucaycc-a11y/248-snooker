-- Track which page(s) each waitlist email came from. `sources` is the set of pages
-- the address signed up on, so a repeat sign-up from another page is still counted.
ALTER TABLE public.waitlist_emails ADD COLUMN IF NOT EXISTS sources text[] NOT NULL DEFAULT '{}';

-- Rows that exist today all came from the main maintenance / coming-soon page.
UPDATE public.waitlist_emails SET sources = ARRAY['maintenance'] WHERE sources = '{}';

CREATE OR REPLACE FUNCTION public.waitlist_add(p_email text, p_source text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.waitlist_emails (email, sources)
  VALUES (p_email, ARRAY[p_source])
  ON CONFLICT (email) DO UPDATE
    SET sources = (SELECT ARRAY(SELECT DISTINCT unnest(public.waitlist_emails.sources || EXCLUDED.sources)));
$$;

REVOKE ALL ON FUNCTION public.waitlist_add(text, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.waitlist_add(text, text) TO service_role;
