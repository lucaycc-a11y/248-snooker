import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, clientIp } from '@/lib/rate-limit'
import { normalizeHkPhone } from '@/lib/auth/profile'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/auth/send-otp  { phone }
// Sends an SMS OTP via Supabase's native phone provider, gated by a server-side
// rate limit the client cannot bypass: max 3 sends per phone / 15 min, plus a
// looser per-IP cap to blunt enumeration. The client only calls verifyOtp.
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null)
    const phone = normalizeHkPhone(body?.phone ?? '')
    if (!phone) {
      return NextResponse.json({ error: 'phone_invalid' }, { status: 422 })
    }

    const okPhone = await rateLimit('auth_otp_phone', phone, 3, 15 * 60)
    const okIp = await rateLimit('auth_otp_ip', `ip:${clientIp(req)}`, 10, 15 * 60)
    if (!okPhone || !okIp) {
      return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
    }

    // Server-side send. signInWithOtp does NOT create a session (that happens on
    // verifyOtp in the browser), so no cookies are written here. shouldCreateUser
    // defaults true → first-time SMS users get an account.
    const supabase = await createClient()
    const { error } = await supabase.auth.signInWithOtp({ phone })
    if (error) {
      // Surface the REAL underlying cause. Supabase wraps Twilio errors, so the
      // message/status/code here is the actual diagnostic (e.g. "phone provider
      // not enabled", Twilio 21608 "unverified number on trial", bad credentials).
      // We log the full object server-side AND return the detail to the client so
      // a broken provider config is visible in the UI rather than a generic retry.
      console.error('send_otp_error', {
        message: error.message,
        status: (error as { status?: number }).status,
        code: (error as { code?: string }).code,
      })
      const isRate = /rate|limit|too many/i.test(error.message)
      return NextResponse.json(
        {
          error: isRate ? 'rate_limited' : 'send_failed',
          detail: error.message,
          code: (error as { code?: string }).code ?? null,
        },
        { status: isRate ? 429 : 502 },
      )
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('send_otp_error', (err as Error).message)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
