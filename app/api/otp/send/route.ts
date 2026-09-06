import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, clientIp } from '@/lib/rate-limit'
import { normalizeHkPhone } from '@/lib/auth/profile'
import { sendEngagelabOtp, mapEngagelabError } from '@/lib/engagelab/otp'
import { getServiceSupabase } from '@/lib/supabase/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    const phone = normalizeHkPhone(body?.phone ?? '')
    const recaptchaToken = typeof body?.recaptchaToken === 'string' ? body.recaptchaToken.trim() : ''

    if (!phone) {
      return NextResponse.json({ code: 'PHONE_INVALID' }, { status: 422 })
    }

    let captchaVerified = false
    if (recaptchaToken) {
      const secretKey = process.env.RECAPTCHA_SECRET_KEY
      if (!secretKey) {
        console.error(JSON.stringify({ event: 'otp.send.captcha_config_missing' }))
        return NextResponse.json({ code: 'OTP_INTERNAL' }, { status: 503 })
      }
      const verifyRes = await fetch('https://www.google.com/recaptcha/api/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ secret: secretKey, response: recaptchaToken }),
      })
      const verifyData = await verifyRes.json() as { success?: boolean; score?: number; action?: string }
      captchaVerified = verifyData.success === true && (verifyData.score ?? 0) >= 0.5 && verifyData.action === 'send_otp'
      if (!captchaVerified) {
        console.warn(JSON.stringify({ event: 'otp.send.captcha_rejected', score: verifyData.score ?? null, action: verifyData.action ?? null }))
      }
    }

    const okPhone = await rateLimit('auth_otp_phone', phone, 3, 15 * 60)
    const okIp = await rateLimit('auth_otp_ip', `ip:${clientIp(req)}`, 10, 15 * 60)
    if (!okPhone || !okIp) {
      return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
    }

    const service = getServiceSupabase()
    const { data: reservation, error: reservationError } = await service.rpc('reserve_login_otp', {
      p_phone: phone,
      p_purpose: 'login',
      p_captcha_verified: captchaVerified,
    }).maybeSingle()
    if (reservationError || !reservation) {
      console.error('[otp/send] reservation_failed', { message: reservationError?.message ?? 'empty reservation', phone })
      return NextResponse.json({ error: 'send_failed' }, { status: 503 })
    }

    const row = reservation as unknown as {
      ok: boolean
      request_id: string | null
      otp_id: string | null
      reason: string | null
      retry_after_seconds: number | null
      requires_captcha: boolean
      locked_until: string | null
      message_id: string | null
      channel: string | null
      expires_at: string | null
      is_owner: boolean
    }
    if (row.reason === 'captcha_required' && captchaVerified) {
      const retry = await service.rpc('reserve_login_otp', {
        p_phone: phone,
        p_purpose: 'login',
        p_captcha_verified: true,
      }).maybeSingle()
      if (retry.error || !retry.data) return NextResponse.json({ code: 'OTP_INTERNAL' }, { status: 503 })
      Object.assign(row, retry.data as object)
    }
    if (row.reason === 'captcha_required') {
      return NextResponse.json({ code: 'CAPTCHA_REQUIRED', requiresCaptcha: true }, { status: 428 })
    }
    if (row.reason === 'phone_not_registered') {
      return NextResponse.json({ code: 'PHONE_NOT_REGISTERED' }, { status: 404 })
    }
    if (row.reason === 'phone_locked') {
      return NextResponse.json({ code: 'PHONE_LOCKED', lockedUntil: row.locked_until, retryAfterSeconds: row.retry_after_seconds }, { status: 423 })
    }
    if (row.reason === 'cooldown') {
      return NextResponse.json({ code: 'OTP_COOLDOWN', retryAfterSeconds: row.retry_after_seconds }, { status: 429 })
    }
    if (!row.ok || !row.request_id || !row.expires_at) {
      return NextResponse.json({ code: 'OTP_INTERNAL' }, { status: 503 })
    }
    if (!row.is_owner) {
      if (row.message_id) {
        console.info('[otp/send] reused_pending', { phone, requestId: row.request_id })
        return NextResponse.json({ success: true, messageId: row.message_id, channel: row.channel ?? 'sms', expiresAt: row.expires_at, reused: true })
      }
      console.warn('[otp/send] send_in_progress', { phone, requestId: row.request_id })
      return NextResponse.json({ error: 'send_in_progress' }, { status: 409 })
    }

    try {
      const engagelabData = await sendEngagelabOtp(phone, 'zh_HK')
      const { data: completed, error: completionError } = await service.rpc('complete_login_otp', {
        p_request_id: row.request_id,
        p_message_id: engagelabData.message_id,
        p_channel: engagelabData.send_channel,
      })
      if (completionError || completed !== true) {
        console.error('[otp/send] reservation_completion_failed', { message: completionError?.message ?? 'reservation was not updated', phone, requestId: row.request_id })
        await service.rpc('expire_login_otp', { p_request_id: row.request_id })
        return NextResponse.json({ error: 'send_failed' }, { status: 503 })
      }
      return NextResponse.json({ success: true, messageId: engagelabData.message_id, channel: engagelabData.send_channel, expiresAt: row.expires_at, reused: false })
    } catch (error: unknown) {
      await service.rpc('expire_login_otp', { p_request_id: row.request_id })
      throw error
    }
  } catch (error: unknown) {
    console.error('[otp/send] error', error)

    if (error && typeof error === 'object' && 'code' in error) {
      const code = (error as { code?: number }).code
      if (typeof code === 'number') {
        const message = mapEngagelabError(code)
        const httpStatus = 'httpStatus' in error && typeof (error as { httpStatus?: number }).httpStatus === 'number'
          ? (error as { httpStatus: number }).httpStatus
          : 400
        return NextResponse.json({ error: message }, { status: httpStatus })
      }
    }

    return NextResponse.json({ error: '發送失敗，請重試' }, { status: 500 })
  }
}
