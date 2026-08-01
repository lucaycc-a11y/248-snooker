-- 248 Snooker — admin_users table (Phase 0 of the /admin rebuild).
-- Run this in the Supabase SQL Editor for project wqmciwieiqvnswvspdyz.
-- Safe to re-run: every statement is idempotent.
--
-- Confirmed (2026-07-02, by the maintainer) that admin_users does NOT already
-- exist in production, so this creates it fresh rather than reconciling drift.
-- Read-only via service_role from lib/data/getAdmin.ts — no authenticated/anon
-- policy is defined, matching the config/cms_content pattern in
-- 0001_pages_foundation.sql.

CREATE TABLE IF NOT EXISTS public.admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  email text NOT NULL UNIQUE,
  role text NOT NULL DEFAULT 'admin' CHECK (role IN ('super_admin','admin')),
  invited_by uuid REFERENCES auth.users(id),
  invite_status text NOT NULL DEFAULT 'active' CHECK (invite_status IN ('pending','active','revoked')),
  invite_token text,
  invite_expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_users_service_role_all" ON public.admin_users;
CREATE POLICY "admin_users_service_role_all"
  ON public.admin_users
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Seed the founding super_admin. Resolves user_id from auth.users by email if
-- that account already exists; leaves it null (bound later at first admin
-- login / accept-invite in a future phase) otherwise.
DO $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'lucaycc@gmail.com' LIMIT 1;

  INSERT INTO public.admin_users (email, role, invite_status, user_id)
  VALUES ('lucaycc@gmail.com', 'super_admin', 'active', v_user_id)
  ON CONFLICT (email) DO UPDATE SET
    role = 'super_admin',
    invite_status = 'active',
    user_id = COALESCE(public.admin_users.user_id, excluded.user_id);
END $$;
