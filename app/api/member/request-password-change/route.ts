import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@/lib/supabase/route-handler'
import { withSecurity } from '@/lib/security/api-wrapper'
import { clientIp } from '@/lib/rate-limit'
import { requestPasswordReset, toEmailLocale } from '@/lib/auth/password-reset'

// ════════════════════════════════════════════════════════════════════════════
// POST /api/member/request-password-change
// Emails the signed-in user a password reset link via the single email-link
// flow (lib/auth/password-reset.ts). Kept for older callers; it no longer
// uses Supabase's built-in mailer.
// ════════════════════════════════════════════════════════════════════════════

async function handleRequestPasswordChange(request: Request) {
  try {
    const supabase = await createRouteHandlerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || !user.email) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const locale = toEmailLocale((await cookies()).get('NEXT_LOCALE')?.value)
    const result = await requestPasswordReset({ email: user.email, ip: clientIp(request), locale })

    if (result.ok) return NextResponse.json({ success: true })
    if (result.error === 'cooldown' || result.error === 'rate_limited') {
      return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
    }
    return NextResponse.json({ error: 'send_failed' }, { status: 502 })
  } catch (error) {
    console.error('[request-password-change] Error:', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}

// Export with security wrapper: CSRF + rate limiting
export const POST = withSecurity(handleRequestPasswordChange, {
  csrf: true,
  rateLimit: {
    bucket: 'password_change_request',
    max: 5,
    windowSeconds: 300, // 5 per 5 minutes
    identifierType: 'both',
  },
})
