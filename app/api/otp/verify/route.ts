import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, clientIp } from '@/lib/rate-limit'
import { normalizeHkPhone } from '@/lib/auth/profile'
import { verifyEngagelabOtp, mapEngagelabError } from '@/lib/engagelab/otp'
import { getServiceSupabase } from '@/lib/supabase/service'
import { findUserByPhone } from '@/lib/auth/phone-binding'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/otp/verify  { phone, messageId, code }
// Verifies an Engagelab OTP then mints a Supabase session for the phone owner.
// Only works for phones already bound to an existing account in public.users.
// Never creates a new account — returns { status: 'not_found' } if the phone
// is unknown so the frontend can prompt the user to choose what to do next.
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

    // Query public.users FIRST — never attempt createUser for a login flow.
    // Phone numbers do not bootstrap accounts: registration is email-first (see
    // lib/auth/signup-state.ts), so an unproven phone gets not_found, never a new
    // identity. Do not "helpfully" create a user here.
    const userId = await findUserByPhone(phone)
    if (!userId) {
      return NextResponse.json({ status: 'not_found' }, { status: 404 })
    }

    const service = getServiceSupabase()

    // Fetch the auth user's email so we can issue a magiclink session.
    // generateLink requires an email — we look it up from auth.users via admin API.
    const { data: userData, error: userError } = await service.auth.admin.getUserById(userId)
    if (userError || !userData?.user?.email) {
      console.error('[otp/verify] getUserById failed', {
        userId,
        message: userError?.message,
        phone,
      })
      return NextResponse.json({ error: '登入失敗，請重試' }, { status: 500 })
    }

    const { data: linkData, error: linkError } = await service.auth.admin.generateLink({
      type: 'magiclink',
      email: userData.user.email,
      options: { redirectTo: process.env.NEXT_PUBLIC_APP_URL || undefined },
    })
    if (linkError || !linkData?.properties?.hashed_token) {
      console.error('[otp/verify] generateLink failed', {
        message: linkError?.message,
        phone,
      })
      return NextResponse.json({ error: '登入失敗，請重試' }, { status: 500 })
    }

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
