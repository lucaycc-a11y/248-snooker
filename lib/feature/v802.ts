// Admin-only gate for the v8.0.2 changes (member-card QR, 我的帳戶 nav label,
// payment page cleanup, member-page address, booking-email address + photos).
// While app_versions 8.0.2 has a FUTURE released_at it is a test build: only
// admins get the new behaviour. Once released (admin → 發佈給所有人) everyone does.
// Public static text (footer/about/meta address) is NOT gated — see CLAUDE.md.
import type { SupabaseClient } from '@supabase/supabase-js'
import { getServiceSupabase } from '@/lib/supabase/service'

export const V802 = '8.0.2'

const db = () => getServiceSupabase() as unknown as SupabaseClient

type VersionState = 'missing' | 'test' | 'released'

async function versionState(version: string): Promise<VersionState> {
  try {
    const { data, error } = await db()
      .from('app_versions')
      .select('released_at')
      .eq('version', version)
      .maybeSingle()
    if (error || !data) return 'missing'
    const at = new Date((data as { released_at: string }).released_at).getTime()
    return at > Date.now() ? 'test' : 'released'
  } catch {
    return 'missing'
  }
}

export async function isAdminUserId(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false
  try {
    const { data } = await db().from('admin_users').select('user_id').eq('user_id', userId).maybeSingle()
    return Boolean(data)
  } catch {
    return false
  }
}

/** true = show the v8.0.2 behaviour to this viewer. Missing row => off (safe default). */
export async function isV802Visible(isAdmin: boolean): Promise<boolean> {
  const state = await versionState(V802)
  if (state === 'released') return true
  if (state === 'test') return isAdmin
  return false
}
