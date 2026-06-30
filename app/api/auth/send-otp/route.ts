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
      console.error('send_otp_error', error.message)
      // Surface Supabase's own provider rate limit distinctly.
      const status = /rate|limit|too many/i.test(error.message) ? 429 : 502
      return NextResponse.json({ error: 'send_failed' }, { status })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('send_otp_error', (err as Error).message)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
