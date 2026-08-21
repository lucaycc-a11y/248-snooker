import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, clientIp } from '@/lib/rate-limit'
import { normalizeHkPhone } from '@/lib/auth/profile'
import { verifyEngagelabOtp, mapEngagelabError } from '@/lib/engagelab/otp'
import { getServiceSupabase } from '@/lib/supabase/service'
import { findUserByPhone } from '@/lib/auth/phone-binding'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PHONE_EMAIL_DOMAIN = 'phone.space8.com.hk'

function toPhoneEmail(phone: string): string {
  // +85291234567 → 91234567@phone.space8.com.hk — synthetic, never receives mail.
  // Only used to give Supabase Auth a unique identity for a phone-only member.
  const digits = phone.replace(/^\+/, '')
  return `${digits}@${PHONE_EMAIL_DOMAIN}`
}

// POST /api/otp/verify  { phone, messageId, code }
// Verifies an Engagelab-sent OTP (from /api/otp/send), then mints the Supabase
// session for the phone owner:
//   1. createUser with a synthetic email + the verified phone (email_confirm +
//      phone_confirm true). First-time users get a row; returners hit the
//      "already registered" error, which is success — resolve them by scanning
//      listUsers for the phone.
//   2. generateLink({ type: 'magiclink', email }) — an officially supported way
//      to issue a session for an email we already trust; magiclink params don't
//      carry phone, hence step 1 must attach the phone first.
//   3. The client exchanges the token_hash from action_link via the standard
//      supabase.auth.verifyOtp({ token_hash, type: 'magiclink' }).
// This keeps Supabase as the session authority — no hand-rolled sessions.
export async function POST(req: NextRequest) {
  try {
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

    const service = getServiceSupabase()
    const email = toPhoneEmail(phone)

    // Create the user if this is a first-time phone sign-in. "already registered"
    // is NOT an error here — it's the returner path; resolve them below.
    const { error: createError } = await service.auth.admin.createUser({
      email,
      phone,
      email_confirm: true,
      phone_confirm: true,
    })
    if (createError && !/already registered/i.test(createError.message)) {
      console.error('[otp/verify] createUser failed', {
        message: createError.message,
        code: (createError as { code?: string }).code,
        phone,
      })
      return NextResponse.json({ error: '登入失敗，請重試' }, { status: 500 })
    }

    // Returner path: query public.users directly instead of scanning listUsers.
    let userEmail = email
    if (createError) {
      const existingId = await findUserByPhone(phone)
      if (!existingId) {
        console.error('[otp/verify] no user with this phone', { phone })
        return NextResponse.json({ error: '此電話號碼未有註冊帳戶' }, { status: 400 })
      }
      // Reconstruct the synthetic email from the canonical phone on record.
      userEmail = toPhoneEmail(phone)
    }

    const { data: linkData, error: linkError } = await service.auth.admin.generateLink({
      type: 'magiclink',
      email: userEmail,
      options: { redirectTo: process.env.NEXT_PUBLIC_APP_URL || undefined },
    })
    if (linkError || !linkData?.properties?.hashed_token) {
      console.error('[otp/verify] generateLink failed', {
        message: linkError?.message,
        phone,
      })
      return NextResponse.json({ error: '登入失敗，請重試' }, { status: 500 })
    }

    // hashed_token IS the token_hash the client exchanges via
    // supabase.auth.verifyOtp({ token_hash, type: 'magiclink' }).
    const tokenHash = linkData.properties.hashed_token

    return NextResponse.json({ success: true, tokenHash })
  } catch (error) {
    const err = error as { code?: number; httpStatus?: number; message?: string }
    console.error('[otp/verify] error', err)

    if (err?.code) {
      const message = mapEngagelabError(err.code)
      return NextResponse.json({ error: message }, { status: err.httpStatus || 400 })
    }

    return NextResponse.json({ error: '驗證失敗，請重試' }, { status: 500 })
  }
}
