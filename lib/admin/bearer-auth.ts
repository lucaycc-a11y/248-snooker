import { getServiceSupabase } from '@/lib/supabase/service'
import { getAdminData, type AdminRole } from '@/lib/data/getAdmin'

// Admin auth for non-browser clients (the iOS app).
//
// The app signs in with Supabase Auth — the same accounts and methods as the web /login — and sends `Authorization: Bearer <access_token>`.
// We validate the token with the service client (auth.getUser verifies it against
// GoTrue), then look the user up in admin_users. Requests without a Bearer header
// fall back to the cookie session so the same routes can be tested from the web.

export type AppAuthResult =
  | { status: 'unauthenticated' }
  | { status: 'not_admin'; userId: string; email: string | null }
  | { status: 'admin'; userId: string; email: string; role: AdminRole; displayName: string | null }

type AdminRow = { email: string; role: string; invite_status: string }

function bearerToken(req: Request): string | null {
  const header = req.headers.get('authorization')
  if (!header) return null
  const match = /^Bearer\s+(.+)$/i.exec(header.trim())
  return match ? match[1] : null
}

export async function authenticateAppRequest(req: Request): Promise<AppAuthResult> {
  const token = bearerToken(req)

  if (!token) {
    const admin = await getAdminData().catch(() => null)
    if (!admin) return { status: 'unauthenticated' }
    return {
      status: 'admin',
      userId: admin.userId,
      email: admin.email,
      role: admin.role,
      displayName: admin.displayName,
    }
  }

  const service = getServiceSupabase()
  const { data, error } = await service.auth.getUser(token)
  if (error || !data.user) return { status: 'unauthenticated' }
  const user = data.user

  const { data: byUserId } = await service
    .from('admin_users')
    .select('email, role, invite_status')
    .eq('user_id', user.id)
    .maybeSingle()
  let row = (byUserId as AdminRow | null) ?? null

  // Same fallback as the web login (lib/data/getAdmin.ts): an admin whose admin_users row has no
  // user_id yet is matched by email. Still requires invite_status = 'active' below.
  if (!row && user.email) {
    const { data: byEmail } = await service
      .from('admin_users')
      .select('email, role, invite_status')
      .eq('email', user.email)
      .is('user_id', null)
      .maybeSingle()
    row = (byEmail as AdminRow | null) ?? null
  }

  if (!row || row.invite_status !== 'active') {
    return { status: 'not_admin', userId: user.id, email: user.email ?? null }
  }

  const { data: profile } = await service
    .from('users')
    .select('display_name')
    .eq('id', user.id)
    .maybeSingle()

  return {
    status: 'admin',
    userId: user.id,
    email: row.email,
    role: row.role === 'super_admin' ? 'super_admin' : 'admin',
    displayName: (profile?.display_name as string | undefined) ?? null,
  }
}
