-- 248 Snooker — cms_versions table (Phase 6 of the /admin rebuild: AI-powered
-- CMS draft/publish trail). Run in the Supabase SQL Editor for project
-- wqmciwieiqvnswvspdyz. Idempotent.
--
-- Every content edit (manual or AI-proposed) is written here first as a draft;
-- app/api/admin/cms/publish/route.ts is the only code path that ever writes
-- public.cms_content. field_key/locale mirror cms_content's (key, locale)
-- primary key so publish is a straightforward upsert.

CREATE TABLE IF NOT EXISTS public.cms_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id uuid,
  page text,
  field_key text NOT NULL,
  locale text NOT NULL DEFAULT 'zh-HK',
  old_value text,
  new_value text NOT NULL,
  changed_by uuid REFERENCES auth.users(id),
  change_source text NOT NULL CHECK (change_source IN ('manual','ai')),
  status text NOT NULL CHECK (status IN ('draft','published')) DEFAULT 'draft',
  published_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.cms_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cms_versions_service_role_all" ON public.cms_versions;
CREATE POLICY "cms_versions_service_role_all"
  ON public.cms_versions
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
