import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, clientIp } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// POST /api/auth/send-email-otp  { email }
// Sends an email OTP via Supabase's native email provider (mirrors send-otp for
// SMS): max 3 sends per email / 15 min, plus a looser per-IP cap. shouldCreateUser
// is explicit true so a first-time email user gets an account, same as SMS.
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null)
    const email = (body?.email ?? '').trim().toLowerCase()
    if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
      return NextResponse.json({ error: 'email_invalid' }, { status: 422 })
    }

    const okEmail = await rateLimit('auth_otp_email', email, 3, 15 * 60)
    const okIp = await rateLimit('auth_otp_ip', `ip:${clientIp(req)}`, 10, 15 * 60)
    if (!okEmail || !okIp) {
      return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
    }

    // Server-side send. signInWithOtp does NOT create a session (that happens on
    // verifyOtp in the browser), so no cookies are written here.
    const supabase = await createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    })
    if (error) {
      console.error('[send-email-otp] error', {
        message: error.message,
        status: (error as { status?: number }).status,
        code: (error as { code?: string }).code,
      })
      const isRate = /rate|limit|too many/i.test(error.message)
      // Deliberately NOT a 5xx — see send-otp/route.ts for why (a 502 hides the
      // JSON body behind an edge "Bad Gateway" page). Client branches on `ok`.
      return NextResponse.json(
        {
          ok: false,
          error: isRate ? 'rate_limited' : 'send_failed',
          detail: error.message,
          code: (error as { code?: string }).code ?? null,
        },
        { status: isRate ? 429 : 200 },
      )
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    const e = err as Error
    console.error('[send-email-otp] crash', { message: e.message, stack: e.stack })
    return NextResponse.json({ ok: false, error: 'internal_error', detail: e.message }, { status: 500 })
  }
}
