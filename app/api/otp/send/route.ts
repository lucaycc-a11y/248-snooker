import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, clientIp } from '@/lib/rate-limit'
import { normalizeHkPhone } from '@/lib/auth/profile'
import { sendEngagelabOtp, mapEngagelabError } from '@/lib/engagelab/otp'

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

    const engagelabData = await sendEngagelabOtp(phone, 'zh_HK')

    return NextResponse.json({
      success: true,
      messageId: engagelabData.message_id,
      channel: engagelabData.send_channel,
    })
  } catch (error: any) {
    console.error('[otp/send] error', error)

    if (error?.code) {
      const message = mapEngagelabError(error.code)
      return NextResponse.json({ error: message }, { status: error.httpStatus || 400 })
    }

    return NextResponse.json({ error: '發送失敗，請重試' }, { status: 500 })
  }
}
