import { createClient } from '@/lib/supabase/server'
import { getServiceSupabase } from '@/lib/supabase/service'

// Server-side admin auth guard. Mirrors getMemberData()'s shape (lib/data/getMember.ts):
// resolve the session user, then look up a privileged row via the service-role
// client (admin_users has no authenticated/anon RLS policy — see
// supabase/migrations/0013_admin_users.sql).

export type AdminRole = 'super_admin' | 'admin'

export type AdminData = {
  userId: string
  email: string
  role: AdminRole
}

type Row = { email: string; role: string; invite_status: string }

export async function getAdminData(): Promise<AdminData | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const service = getServiceSupabase()

  const { data: byUserId } = await service
    .from('admin_users')
    .select('email, role, invite_status')
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
      .select('email, role, invite_status')
      .eq('email', user.email)
      .is('user_id', null)
      .maybeSingle()
    row = byEmail as Row | null
  }

  if (!row || row.invite_status !== 'active') return null

  return { userId: user.id, email: row.email, role: row.role as AdminRole }
}
