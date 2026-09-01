import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { normalizeHkPhone } from '@/lib/auth/profile'
import { rateLimit, clientIp } from '@/lib/rate-limit'
import { sendEngagelabOtp } from '@/lib/engagelab/otp'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic' // reads auth cookies — never prerender

type Body = { phone?: unknown }

// POST /api/profile/complete/send-otp  { phone }
// Authenticated half of the profile-completion phone verification. Sends an OTP
// to a format-valid HK number and returns the provider message id, which the
// client replays into POST /api/profile/complete so the completion write and the
// code verification happen in one atomic step (no window where a phone is bound
// but the profile never completes).
//
// No reCAPTCHA here: unlike the public contact-change send, the caller is already
// session-authenticated, so the session IS the proof of humanity. Throttling
// still applies — an IP bucket plus a per-phone bucket so an attacker cannot burn
// OTP credits across many numbers from one machine.
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      const status = (authError as { status?: number } | null)?.status
      console.error('[profile/complete/send-otp] auth.getUser failed:', {
        message: authError?.message ?? 'no user, no error (missing/partial session cookie)',
        status,
      })
      if (authError && (status === undefined || status >= 500)) {
        return NextResponse.json({ error: 'auth_unavailable' }, { status: 503 })
      }
      return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })
    }

    const body = (await request.json().catch(() => null)) as Body | null
    const phone = normalizeHkPhone(typeof body?.phone === 'string' ? body.phone : '')
    if (!phone) return NextResponse.json({ error: 'invalid_phone' }, { status: 422 })

    const okIp = await rateLimit('auth_otp_ip', `ip:${clientIp(request)}`, 10, 15 * 60)
    if (!okIp) return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
    const okPhone = await rateLimit('auth_profile_complete_phone', phone, 3, 15 * 60)
    if (!okPhone) return NextResponse.json({ error: 'rate_limited' }, { status: 429 })

    try {
      const sms = await sendEngagelabOtp(phone, 'zh_HK')
      console.log('[profile/complete/send-otp] sent', { userId: user.id, channel: sms.send_channel })
      return NextResponse.json({ ok: true, messageId: sms.message_id, channel: sms.send_channel })
    } catch (error) {
      console.error('[profile/complete/send-otp] delivery failed', error)
      return NextResponse.json({ error: 'send_failed' }, { status: 502 })
    }
  } catch (error) {
    console.error('[profile/complete/send-otp] error', error)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
