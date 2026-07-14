-- 248 Snooker — cms_versions 'reverted' status (Phase E: undo, extending the
-- existing republish flow built in Phase 6). Run in the Supabase SQL Editor
-- for project wqmciwieiqvnswvspdyz. Idempotent.
--
-- The republish flow (app/api/admin/cms/publish/route.ts) already restores
-- old_value as new content when re-publishing a historical version — this
-- just lets that rollback-created row carry a distinct status so the history
-- UI can visually tell "this was a rollback" from "this was a forward edit".

DO $$
BEGIN
  ALTER TABLE public.cms_versions DROP CONSTRAINT IF EXISTS cms_versions_status_check;
  ALTER TABLE public.cms_versions ADD CONSTRAINT cms_versions_status_check
    CHECK (status IN ('draft','published','reverted'));
END $$;
