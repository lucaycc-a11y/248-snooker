import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { normalizeHkPhone } from '@/lib/auth/profile'
import { rateLimit, clientIp } from '@/lib/rate-limit'
import { sendEngagelabOtp } from '@/lib/engagelab/otp'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic' // reads auth cookies — never prerender

type Body = { phone?: unknown }

type OtpErrorCode = 'AUTH_REQUIRED' | 'PHONE_INVALID' | 'OTP_RATE_LIMITED' | 'OTP_SEND_FAILED' | 'OTP_INTERNAL'

function jsonError(code: OtpErrorCode, status: number, requestId: string, retryAfterSeconds?: number) {
  return NextResponse.json({ code, requestId, ...(retryAfterSeconds ? { retryAfterSeconds } : {}) }, { status })
}

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
  const requestId = crypto.randomUUID()
  const startedAt = Date.now()
  console.log(JSON.stringify({ event: 'otp.profile.send.received', requestId, at: new Date().toISOString() }))
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      const status = (authError as { status?: number } | null)?.status
      console.error(JSON.stringify({ event: 'otp.profile.send.auth_failed', requestId, message: authError?.message ?? 'missing session', status }))
      if (authError && (status === undefined || status >= 500)) {
        return jsonError('OTP_INTERNAL', 503, requestId)
      }
      return jsonError('AUTH_REQUIRED', 401, requestId)
    }

    const body = (await request.json().catch(() => null)) as Body | null
    const phone = normalizeHkPhone(typeof body?.phone === 'string' ? body.phone : '')
    console.log(JSON.stringify({ event: 'otp.profile.send.validation', requestId, phone: phone ? `***${phone.slice(-3)}` : null, valid: Boolean(phone) }))
    if (!phone) return jsonError('PHONE_INVALID', 422, requestId)

    const okIp = await rateLimit('auth_otp_ip', `ip:${clientIp(request)}`, 10, 15 * 60)
    if (!okIp) return jsonError('OTP_RATE_LIMITED', 429, requestId, 900)
    const okPhone = await rateLimit('auth_profile_complete_phone', phone, 3, 15 * 60)
    if (!okPhone) return jsonError('OTP_RATE_LIMITED', 429, requestId, 900)

    try {
      const providerStartedAt = Date.now()
      const sms = await sendEngagelabOtp(phone, 'zh_HK')
      console.log(JSON.stringify({ event: 'otp.profile.send.provider', requestId, userId: user.id, channel: sms.send_channel, messageId: sms.message_id, durationMs: Date.now() - providerStartedAt }))
      console.log(JSON.stringify({ event: 'otp.profile.send.success', requestId, userId: user.id, durationMs: Date.now() - startedAt }))
      return NextResponse.json({ ok: true, requestId, messageId: sms.message_id, channel: sms.send_channel, expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString() })
    } catch (error) {
      console.error(JSON.stringify({ event: 'otp.profile.send.provider_failed', requestId, error: error instanceof Error ? error.message : String(error), durationMs: Date.now() - startedAt }))
      return jsonError('OTP_SEND_FAILED', 502, requestId)
    }
  } catch (error) {
    console.error(JSON.stringify({ event: 'otp.profile.send.failed', requestId, error: error instanceof Error ? error.message : String(error), durationMs: Date.now() - startedAt }))
    return jsonError('OTP_INTERNAL', 500, requestId)
  }
}
