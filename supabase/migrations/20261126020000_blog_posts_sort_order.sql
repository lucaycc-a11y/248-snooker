ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS sort_order integer;
ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.blog_posts_touch_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS blog_posts_touch_updated_at ON public.blog_posts;
CREATE TRIGGER blog_posts_touch_updated_at BEFORE UPDATE ON public.blog_posts
  FOR EACH ROW EXECUTE FUNCTION public.blog_posts_touch_updated_at();

CREATE INDEX IF NOT EXISTS blog_posts_locale_sort_idx ON public.blog_posts (locale, sort_order, published_at DESC);
