// Registration step 2 of 2: redeem the SMS code, then create the account.
//
// This is the only place a registration-time Supabase Auth user is created, and it
// refuses to run unless the attempt carries both verification timestamps. The
// matching database constraint (users_profile_complete_verified_chk) enforces the
// same invariant, so a bug here fails closed rather than producing a "complete"
// profile with an unproven contact.
import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/service'
import { normalizeHkPhone } from '@/lib/auth/profile'
import { rateLimit, clientIp } from '@/lib/rate-limit'
import { verifyEngagelabOtp } from '@/lib/engagelab/otp'
import { canFinalize, canVerifyPhone, type SignupStatus } from '@/lib/auth/signup-state'
import { clearSignupSecretCookie, decryptSignupSecret, signupSecretFromCookieHeader } from '@/lib/auth/signup-secret'
import { generateMemberCode } from '@/lib/member/planetSystem'

type Body = { signupId?: unknown; phone?: unknown; messageId?: unknown; code?: unknown }
type SignupAttempt = {
  id: string
  display_name: string
  email: string
  phone: string
  status: SignupStatus
  email_verified_at: string | null
  phone_verified_at: string | null
  expires_at: string
  sms_message_id: string | null
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function isAlreadyRegistered(message: string | undefined): boolean {
  return /already.*(registered|exists)|duplicate/i.test(message ?? '')
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as Body | null
    const signupId = typeof body?.signupId === 'string' ? body.signupId : ''
    const messageId = typeof body?.messageId === 'string' ? body.messageId : ''
    const code = typeof body?.code === 'string' ? body.code.trim() : ''
    const submittedPhone = normalizeHkPhone(typeof body?.phone === 'string' ? body.phone : '')
    if (!submittedPhone || !signupId || !messageId || !code) {
      return NextResponse.json({ error: 'invalid_input' }, { status: 422 })
    }

    const okIp = await rateLimit('auth_signup_verify_ip', `ip:${clientIp(request)}`, 10, 15 * 60)
    if (!okIp) return NextResponse.json({ error: 'rate_limited' }, { status: 429 })

    const secret = decryptSignupSecret(signupSecretFromCookieHeader(request.headers.get('cookie')))
    if (!secret || secret.signupId !== signupId) return NextResponse.json({ error: 'signup_expired' }, { status: 410 })

    const service = getServiceSupabase()
    const { data: attempt, error: lookupError } = await service
      .from('auth_signup_attempts')
      .select('id, display_name, email, phone, status, email_verified_at, phone_verified_at, expires_at, sms_message_id')
      .eq('id', signupId)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle<SignupAttempt>()
    if (lookupError) return NextResponse.json({ error: 'internal_error' }, { status: 500 })
    if (
      !attempt ||
      !canVerifyPhone(attempt.status) ||
      attempt.phone !== submittedPhone ||
      attempt.sms_message_id !== messageId
    ) {
      return NextResponse.json({ error: 'signup_expired' }, { status: 410 })
    }

    const verified = await verifyEngagelabOtp(messageId, code)
    if (verified.verified !== true) return NextResponse.json({ error: 'invalid_code' }, { status: 400 })

    const verifiedAt = new Date().toISOString()
    const { data: advanced, error: advanceError } = await service
      .from('auth_signup_attempts')
      .update({ phone_verified_at: verifiedAt, status: 'phone_verified' })
      .eq('id', attempt.id)
      .eq('status', 'email_verified')
      .select('id, display_name, email, phone, status, email_verified_at, phone_verified_at, expires_at')
      .maybeSingle<SignupAttempt>()
    if (advanceError) return NextResponse.json({ error: 'internal_error' }, { status: 500 })
    if (!advanced || !canFinalize(advanced)) return NextResponse.json({ error: 'signup_expired' }, { status: 410 })

    const { data: authData, error: authError } = await service.auth.admin.createUser({
      email: advanced.email,
      email_confirm: true,
      phone: advanced.phone,
      phone_confirm: true,
      user_metadata: { full_name: advanced.display_name },
      password: secret.password,
    })
    if (authError || !authData.user) {
      if (isAlreadyRegistered(authError?.message) || authError?.code === 'email_exists') {
        return NextResponse.json({ error: 'email_exists' }, { status: 409 })
      }
      console.error('[auth/signup/verify-phone] create user failed', authError)
      return NextResponse.json({ error: 'internal_error' }, { status: 500 })
    }

    let memberCode: string | null = null
    for (let i = 0; i < 5 && !memberCode; i += 1) {
      const candidate = generateMemberCode('amateur')
      const { data: clash } = await service.from('users').select('id').eq('member_code', candidate).maybeSingle()
      if (!clash) memberCode = candidate
    }
    if (!memberCode) {
      await service.auth.admin.deleteUser(authData.user.id)
      console.error('[auth/signup/verify-phone] member code generation failed')
      return NextResponse.json({ error: 'internal_error' }, { status: 500 })
    }

    const { error: profileError } = await service.from('users').upsert(
      {
        id: authData.user.id,
        display_name: advanced.display_name,
        email: advanced.email,
        phone: advanced.phone,
        member_code: memberCode,
        email_verified_at: advanced.email_verified_at,
        phone_verified_at: advanced.phone_verified_at,
        profile_complete: true,
        updated_at: verifiedAt,
      },
      { onConflict: 'id' },
    )
    if (profileError) {
      await service.auth.admin.deleteUser(authData.user.id)
      if (profileError.code === '23505') return NextResponse.json({ error: 'identity_in_use' }, { status: 409 })
      console.error('[auth/signup/verify-phone] profile creation failed', profileError)
      return NextResponse.json({ error: 'internal_error' }, { status: 500 })
    }

    // Official Supabase token exchange — the browser completes sign-in through
    // GoTrue rather than us minting anything session-shaped ourselves.
    const { data: linkData, error: linkError } = await service.auth.admin.generateLink({
      type: 'magiclink',
      email: advanced.email,
      options: { redirectTo: process.env.NEXT_PUBLIC_APP_URL || undefined },
    })
    if (linkError || !linkData?.properties?.hashed_token) {
      await service.auth.admin.deleteUser(authData.user.id)
      console.error('[auth/signup/verify-phone] session link generation failed', linkError)
      return NextResponse.json({ error: 'internal_error' }, { status: 500 })
    }

    const { error: completeError } = await service
      .from('auth_signup_attempts')
      .update({ status: 'completed', completed_at: verifiedAt })
      .eq('id', advanced.id)
      .eq('status', 'phone_verified')
    if (completeError) {
      await service.auth.admin.deleteUser(authData.user.id)
      console.error('[auth/signup/verify-phone] attempt completion failed', completeError)
      return NextResponse.json({ error: 'internal_error' }, { status: 500 })
    }

    const response = NextResponse.json({
      ok: true,
      userId: authData.user.id,
      tokenHash: linkData.properties.hashed_token,
    })
    clearSignupSecretCookie(response)
    return response
  } catch (error) {
    console.error('[auth/signup/verify-phone] error', error)
    return NextResponse.json({ error: 'verification_failed' }, { status: 500 })
  }
}
