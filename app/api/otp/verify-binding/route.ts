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
  const reqId = crypto.randomUUID().slice(0, 8)
  console.log(`[verify-binding:${reqId}] request received`, { ts: Date.now() })

  try {
    const supabase = await createClient()
    const { data: userData, error: userErr } = await supabase.auth.getUser()
    console.log(`[verify-binding:${reqId}] getUser`, {
      hasUser: !!userData?.user,
      userId: userData?.user?.id ?? null,
      error: userErr?.message ?? null,
      ts: Date.now(),
    })

    if (!userData?.user) {
      console.warn(`[verify-binding:${reqId}] no user, returning 401`, { ts: Date.now() })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => (null as Record<string, unknown> | null))
    const phone = normalizeHkPhone(String(body?.phone ?? ''))
    const messageId = typeof body?.messageId === 'string' ? body.messageId.trim() : ''
    const code = typeof body?.code === 'string' ? body.code.trim() : ''

    console.log(`[verify-binding:${reqId}] body parsed`, {
      hasPhone: !!body?.phone,
      hasMessageId: !!body?.messageId,
      hasCode: !!body?.code,
      phoneTail: phone?.slice(-3) ?? null,
      messageIdTail: messageId.slice(-4) || null,
      ts: Date.now(),
    })

    if (!phone || !messageId || !code) {
      console.warn(`[verify-binding:${reqId}] missing param, returning 400`, {
        hasPhone: !!phone,
        hasMessageId: !!messageId,
        hasCode: !!code,
        ts: Date.now(),
      })
      return NextResponse.json({ error: '缺少必要參數' }, { status: 400 })
    }

    const okIp = await rateLimit('auth_otp_verify_ip', `ip:${clientIp(req)}`, 10, 15 * 60)
    const okPhone = await rateLimit('auth_otp_verify_phone', phone, 5, 15 * 60)
    console.log(`[verify-binding:${reqId}] rate limit`, {
      okIp,
      okPhone,
      ip: clientIp(req),
      ts: Date.now(),
    })
    if (!okIp || !okPhone) {
      console.warn(`[verify-binding:${reqId}] rate limited, returning 429`, { ts: Date.now() })
      return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
    }

    const verified = await verifyEngagelabOtp(messageId, code)
    console.log(`[verify-binding:${reqId}] engagelab verify result`, {
      verified: verified?.verified,
      code: verified?.code,
      message: verified?.message,
      ts: Date.now(),
    })

    if (verified.verified !== true) {
      console.warn(`[verify-binding:${reqId}] otp not verified, returning 400`, {
        engagelabCode: verified?.code,
        engagelabMessage: verified?.message,
        ts: Date.now(),
      })
      return NextResponse.json({ error: '驗證碼不正確' }, { status: 400 })
    }

    console.log(`[verify-binding:${reqId}] calling bindVerifiedPhone`, {
      userId: userData.user.id,
      phoneTail: phone.slice(-3),
      ts: Date.now(),
    })

    const result = await bindVerifiedPhone(userData.user.id, phone)

    console.log(`[verify-binding:${reqId}] bindVerifiedPhone result`, {
      ok: result.ok,
      error: result.ok ? null : result.error,
      alreadyVerified: result.ok ? result.alreadyVerified ?? false : null,
      ts: Date.now(),
    })

    if (!result.ok) {
      if (result.error === 'phone_taken') {
        console.warn(`[verify-binding:${reqId}] phone_taken, returning 409`, { ts: Date.now() })
        return NextResponse.json({ status: 'phone_taken' }, { status: 409 })
      }
      if (result.error === 'phone_invalid') {
        console.warn(`[verify-binding:${reqId}] phone_invalid, returning 400`, { ts: Date.now() })
        return NextResponse.json({ error: '電話號碼格式不正確' }, { status: 400 })
      }
      // db_error: transient failure or a constraint we couldn't classify — a
      // distinct response lets the client show a "retry" message instead of
      // misreporting it as a wrong code.
      console.error(`[verify-binding:${reqId}] db_error, returning 500`, { ts: Date.now() })
      return NextResponse.json({ error: 'db_error' }, { status: 500 })
    }

    // alreadyVerified: the OTP was correct, but this phone was already bound to
    // this same account (e.g. re-verifying). Treat as success, not an error.
    if (result.alreadyVerified) {
      console.log(`[verify-binding:${reqId}] success (alreadyVerified)`, { ts: Date.now() })
      return NextResponse.json({ success: true, alreadyVerified: true })
    }
    console.log(`[verify-binding:${reqId}] success`, { ts: Date.now() })
    return NextResponse.json({ success: true })
  } catch (error) {
    // Log full error object so transient failures are diagnosable — the previous
    // destructuring only captured code/httpStatus/message, losing the cause.
    console.error(`[verify-binding:${reqId}] UNCAUGHT ERROR`, {
      errName: error instanceof Error ? error.name : typeof error,
      errMessage: error instanceof Error ? error.message : String(error),
      errStack: error instanceof Error ? error.stack : undefined,
      code: (error as { code?: number }).code,
      httpStatus: (error as { httpStatus?: number }).httpStatus,
      ts: Date.now(),
    })

    if ((error as { code?: number }).code) {
      const message = mapEngagelabError((error as { code: number }).code)
      return NextResponse.json({ error: message }, { status: (error as { httpStatus?: number }).httpStatus || 400 })
    }

    return NextResponse.json({ error: '驗證失敗，請重試' }, { status: 500 })
  }
}
