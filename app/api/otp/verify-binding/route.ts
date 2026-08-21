import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, clientIp } from '@/lib/rate-limit'
import { normalizeHkPhone } from '@/lib/auth/profile'
import { verifyEngagelabOtp, mapEngagelabError } from '@/lib/engagelab/otp'
import { createClient } from '@/lib/supabase/server'
import { bindVerifiedPhone } from '@/lib/auth/phone-binding'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/otp/verify-binding  { phone, messageId, code }
// For already-authenticated users: verifies OTP and binds the phone to their account.
// Returns { status: 'phone_taken' } if another account already holds this number.
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => null)
    const phone = normalizeHkPhone(body?.phone ?? '')
    const messageId = typeof body?.messageId === 'string' ? body.messageId.trim() : ''
    const code = typeof body?.code === 'string' ? body.code.trim() : ''

    if (!phone || !messageId || !code) {
      return NextResponse.json({ error: '缺少必要參數' }, { status: 400 })
    }

    const okIp = await rateLimit('auth_otp_verify_ip', `ip:${clientIp(req)}`, 10, 15 * 60)
    const okPhone = await rateLimit('auth_otp_verify_phone', phone, 5, 15 * 60)
    if (!okIp || !okPhone) {
      return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
    }

    const verified = await verifyEngagelabOtp(messageId, code)
    if (verified.verified !== true) {
      return NextResponse.json({ error: '驗證碼不正確' }, { status: 400 })
    }

    const result = await bindVerifiedPhone(user.id, phone)
    if (!result.ok) {
      if (result.error === 'phone_taken') {
        return NextResponse.json({ status: 'phone_taken' }, { status: 409 })
      }
      if (result.error === 'phone_invalid') {
        return NextResponse.json({ error: '電話號碼格式不正確' }, { status: 400 })
      }
      return NextResponse.json({ error: '綁定失敗，請重試' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    const err = error as { code?: number; httpStatus?: number; message?: string }
    console.error('[otp/verify-binding] error', err)

    if (err?.code) {
      const message = mapEngagelabError(err.code)
      return NextResponse.json({ error: message }, { status: err.httpStatus || 400 })
    }

    return NextResponse.json({ error: '驗證失敗，請重試' }, { status: 500 })
  }
}
