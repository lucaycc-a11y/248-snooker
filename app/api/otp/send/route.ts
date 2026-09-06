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
    const recaptchaToken = body?.recaptchaToken ?? ''

    if (!phone) {
      return NextResponse.json({ error: '缺少必要參數' }, { status: 400 })
    }

    if (!recaptchaToken) {
      return NextResponse.json({ error: '缺少必要參數' }, { status: 400 })
    }

    const secretKey = process.env.RECAPTCHA_SECRET_KEY
    if (!secretKey) {
      console.error('[otp/send] RECAPTCHA_SECRET_KEY not configured')
      return NextResponse.json({ error: '系統配置錯誤' }, { status: 500 })
    }

    const verifyRes = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: secretKey,
        response: recaptchaToken,
      }),
    })
    const verifyData = await verifyRes.json()

    if (!verifyData.success || verifyData.score < 0.5) {
      console.warn('[reCAPTCHA] rejected', {
        score: verifyData.score,
        action: verifyData.action,
        success: verifyData.success,
      })
      return NextResponse.json({ error: '驗證失敗，請重試' }, { status: 400 })
    }

    const okPhone = await rateLimit('auth_otp_phone', phone, 3, 15 * 60)
    const okIp = await rateLimit('auth_otp_ip', `ip:${clientIp(req)}`, 10, 15 * 60)
    if (!okPhone || !okIp) {
      return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
    }

    const service = getServiceSupabase()
    const { data: reservation, error: reservationError } = await service.rpc('reserve_login_otp', {
      p_phone: phone,
    }).maybeSingle()
    if (reservationError || !reservation) {
      console.error('[otp/send] reservation_failed', { message: reservationError?.message ?? 'empty reservation', phone })
      return NextResponse.json({ error: 'send_failed' }, { status: 503 })
    }

    const row = reservation as unknown as {
      request_id: string
      message_id: string | null
      channel: string | null
      expires_at: string
      is_owner: boolean
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
