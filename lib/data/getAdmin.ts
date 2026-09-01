import { createClient } from '@/lib/supabase/server'
import { getServiceSupabase } from '@/lib/supabase/service'

// Server-side admin auth guard. Mirrors getMemberData()'s shape (lib/data/getMember.ts):
// resolve the session user, then look up a privileged row via the service-role
// client (admin_users has no authenticated/anon RLS policy — see
// supabase/migrations/0013_admin_users.sql).

export type AdminRole = 'super_admin' | 'admin'

export type AdminThemePreference = 'dark' | 'light' | 'system'

export type AdminData = {
  userId: string
  email: string
  role: AdminRole
  displayName: string | null
  themePreference: AdminThemePreference
}

type Row = { email: string; role: string; invite_status: string; theme_preference: string | null }

export async function getAdminData(): Promise<AdminData | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const service = getServiceSupabase()

  const { data: byUserId } = await service
    .from('admin_users')
    .select('email, role, invite_status, theme_preference')
    .eq('user_id', user.id)
    .maybeSingle()

  let row = byUserId as Row | null

  // Falls back to email match for admins whose auth.users row predates their
  // admin_users row (e.g. the seeded super_admin before their first login).
  // Still gated on invite_status = 'active' below, so a 'pending' invite row
  // never grants access this way.
  if (!row && user.email) {
    const { data: byEmail } = await service
      .from('admin_users')
      .select('email, role, invite_status, theme_preference')
      .eq('email', user.email)
      .is('user_id', null)
      .maybeSingle()
    row = byEmail as Row | null
  }

  if (!row || row.invite_status !== 'active') return null

  // display_name lives on `users`, not `admin_users` — same source the member
  // dashboard reads (lib/data/getMember.ts). Best-effort: a missing profile
  // row just falls back to null, never blocks admin access.
  const { data: profile } = await service
    .from('users')
    .select('display_name')
    .eq('id', user.id)
    .maybeSingle()

  return {
    userId: user.id,
    email: row.email,
    role: row.role as AdminRole,
    displayName: (profile?.display_name as string | undefined) ?? null,
    themePreference:
      row.theme_preference === 'light' || row.theme_preference === 'system'
        ? row.theme_preference
        : 'dark',
  }
}
