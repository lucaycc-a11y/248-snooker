// Shared server-side admin gate for the dev2 panel routes.
//
// The same check was copy-pasted across app/api/deploy/*; the UAT test-pricing
// and refund routes need it too, and a security check duplicated five times is a
// check that eventually drifts in one place. Callers MUST treat isAdmin === false
// as a hard 403 — there is no client-side-only variant of this.

import { createClient } from '@/lib/supabase/server'
import type { User } from '@supabase/supabase-js'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

export type AdminAuthResult =
  | { isAdmin: true; user: User; adminRole: string | null }
  | { isAdmin: false; user: User | null; adminRole: null; error: string }

/**
 * Verify the caller is a signed-in, ACTIVE admin.
 *
 * Both conditions matter: `is_active = true` is what distinguishes a current
 * admin from a revoked one, so it is never omitted.
 */
export async function requireActiveAdmin(
  supabase: SupabaseServerClient,
): Promise<AdminAuthResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { isAdmin: false, user: null, adminRole: null, error: 'Not authenticated' }
  }

  const { data: adminEntry } = await supabase
    .from('admin_users')
    .select('user_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!adminEntry) {
    return {
      isAdmin: false,
      user,
      adminRole: null,
      error: 'Not authorized - admin access required',
    }
  }

  const role = (adminEntry as { role?: unknown }).role
  return { isAdmin: true, user, adminRole: typeof role === 'string' ? role : null }
}

/** First-hop client IP, for audit_log rows. */
export function getClientIp(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  )
}
