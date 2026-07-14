-- 248 Snooker — cms_list_items (Phase A-list: addable/removable/reorderable
-- content lists — FAQ items, legal document sections). Run in the Supabase
-- SQL Editor for project wqmciwieiqvnswvspdyz. Idempotent.
--
-- Separate from cms_content/CMSText's fixed key-value model: FAQ and legal
-- sections are open-ended lists an admin can add/delete/reorder, which a
-- single key can't express (there's no key to seed until the item exists).
-- fields is jsonb so one table serves both {question, answer} FAQ pairs and
-- {title, body} legal sections without a schema per collection.
--
-- Per the user: RLS (public read of published rows, admin write) and
-- Realtime publication membership are already configured. This migration is
-- committed anyway for the repo's schema history, matching every other
-- table this session.

CREATE TABLE IF NOT EXISTS public.cms_list_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page text NOT NULL,
  collection_key text NOT NULL,
  locale text NOT NULL DEFAULT 'zh-HK',
  order_index integer NOT NULL DEFAULT 0,
  fields jsonb NOT NULL,
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cms_list_items_lookup_idx
  ON public.cms_list_items (page, collection_key, locale, order_index);

ALTER TABLE public.cms_list_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cms_list_items_public_read_published" ON public.cms_list_items;
CREATE POLICY "cms_list_items_public_read_published"
  ON public.cms_list_items
  FOR SELECT
  USING (status = 'published');

DROP POLICY IF EXISTS "cms_list_items_service_role_all" ON public.cms_list_items;
CREATE POLICY "cms_list_items_service_role_all"
  ON public.cms_list_items
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
