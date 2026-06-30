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
      // Supabase wraps Twilio errors; this message/code IS the real diagnostic
      // (e.g. "Unsupported phone provider" / provider disabled, Twilio 21608
      // "unverified number on trial", bad credentials).
      console.error('send_otp_error', {
        message: error.message,
        status: (error as { status?: number }).status,
        code: (error as { code?: string }).code,
      })
      const isRate = /rate|limit|too many/i.test(error.message)
      // Deliberately NOT a 5xx: a 502 from this route gets misdiagnosed as a
      // function crash, and its JSON body can be hidden behind an edge "Bad
      // Gateway" page so the real cause never reaches the UI. Return the
      // Supabase/Twilio detail in a 200 body with ok:false (rate limit keeps
      // 429); the client branches on `ok`.
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
    // Genuine unhandled crash (signInWithOtp threw rather than returned error).
    // Log the stack and return the detail so it's never a blank 500.
    const e = err as Error
    console.error('send_otp_error', { message: e.message, stack: e.stack })
    return NextResponse.json({ ok: false, error: 'internal_error', detail: e.message }, { status: 500 })
  }
}
