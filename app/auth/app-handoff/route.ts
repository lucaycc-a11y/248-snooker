import crypto from 'node:crypto'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'

// "Use the web login" for the iOS admin app.
//
// The app opens   https://space8.com.hk/auth/app-handoff   in ASWebAuthenticationSession.
//   - not signed in  -> /login (the normal web login: Apple, Google, email, password …),
//                       which returns here afterwards;
//   - signed in, active admin -> redirect to  space8admin://auth?code=<one-time code>
//   - signed in, not an admin -> redirect to  space8admin://auth?error=not_admin
// The app then POSTs the code to /api/admin/exchange-session to receive its own
// access/refresh tokens. Codes are single-use and expire after 5 minutes.
export const dynamic = 'force-dynamic'

const APP_SCHEME = 'space8admin://auth'
const HANDOFF_PATH = '/auth/app-handoff'

export async function GET(request: Request) {
  const { origin } = new URL(request.url)

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(`${origin}/login?returnUrl=${encodeURIComponent(HANDOFF_PATH)}`)
  }

  const admin = await getAdminData().catch(() => null)
  if (!admin) return NextResponse.redirect(`${APP_SCHEME}?error=not_admin`)

  const service = getLegacyServiceSupabase()
  const { data: row } = await service
    .from('admin_users')
    .select('id')
    .eq('user_id', admin.userId)
    .eq('invite_status', 'active')
    .maybeSingle()
  const adminRowId = (row as { id: string } | null)?.id
  // exchange-session needs admin_users.user_id to be bound; an email-only match cannot hand off.
  if (!adminRowId) return NextResponse.redirect(`${APP_SCHEME}?error=not_admin`)

  const code = crypto.randomBytes(32).toString('hex')
  const { error } = await service.from('login_exchange_codes').insert({
    code,
    admin_user_id: adminRowId,
    redirect_scheme: APP_SCHEME,
    expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  })
  if (error) {
    console.error('[auth/app-handoff] insert failed', error.message)
    return NextResponse.redirect(`${APP_SCHEME}?error=server`)
  }

  const res = NextResponse.redirect(`${APP_SCHEME}?code=${code}`)
  res.headers.set('Cache-Control', 'no-store')
  return res
}
