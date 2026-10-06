'use server'

import { cookies, headers } from 'next/headers'
import { createRouteHandlerClient } from '@/lib/supabase/route-handler'
import {
  completePasswordReset,
  requestPasswordReset,
  toEmailLocale,
  type CompleteResetResult,
  type RequestResetResult,
} from '@/lib/auth/password-reset'

// Server actions for /reset-password and the Settings「更改密碼」row. Next.js
// rejects cross-origin action POSTs (Origin vs Host), which covers CSRF.

async function requestContext() {
  const h = await headers()
  const fwd = h.get('x-forwarded-for')
  const ip = (fwd ? fwd.split(',')[0] : h.get('x-real-ip'))?.trim() || 'unknown'
  const locale = toEmailLocale((await cookies()).get('NEXT_LOCALE')?.value)
  return { ip, locale }
}

/** Login page「忘記密碼？」: the user types an email. */
export async function requestResetByEmail(email: string): Promise<RequestResetResult> {
  const { ip, locale } = await requestContext()
  return requestPasswordReset({ email, ip, locale })
}

/** Settings「更改密碼」: no input — the account email is read server-side. */
export async function requestResetForCurrentUser(): Promise<RequestResetResult | { ok: false; error: 'unauthorized' | 'no_email' }> {
  const supabase = await createRouteHandlerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'unauthorized' }
  if (!user.email) return { ok: false, error: 'no_email' }
  const { ip, locale } = await requestContext()
  return requestPasswordReset({ email: user.email, ip, locale })
}

/** Reset page submit: verify token + set password + sign out everywhere. */
export async function submitNewPassword(input: {
  tokenHash: string
  password: string
  confirm: string
}): Promise<CompleteResetResult> {
  const { ip, locale } = await requestContext()
  const result = await completePasswordReset({ ...input, ip, locale })
  if (result.ok) {
    // Clear this browser's (now revoked) session cookies too.
    const supabase = await createRouteHandlerClient()
    await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined)
  }
  return result
}
