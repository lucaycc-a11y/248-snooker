import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/service'
import { rateLimit, clientIp } from '@/lib/rate-limit'
import { isVerificationCodeValid } from '@/lib/auth/verification'
import { clearSignupSecretCookie, decryptSignupSecret, signupSecretFromCookieHeader } from '@/lib/auth/signup-secret'
import { generateMemberCode } from '@/lib/member/planetSystem'

type Body = { signupId?: unknown; code?: unknown }
type SignupAttempt = {
  id: string
  display_name: string
  email: string
  phone: string
  phone_verified_at: string | null
  email_code_hash: string | null
  email_code_expires_at: string | null
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
    const code = typeof body?.code === 'string' ? body.code.trim() : ''
    if (!signupId || !/^\d{6}$/.test(code)) return NextResponse.json({ error: 'invalid_input' }, { status: 422 })

    const okIp = await rateLimit('auth_signup_email_verify_ip', `ip:${clientIp(request)}`, 10, 15 * 60)
    if (!okIp) return NextResponse.json({ error: 'rate_limited' }, { status: 429 })

    const secretValue = signupSecretFromCookieHeader(request.headers.get('cookie'))
    const secret = decryptSignupSecret(secretValue)
    if (!secret || secret.signupId !== signupId) return NextResponse.json({ error: 'signup_expired' }, { status: 410 })

    const service = getServiceSupabase()
    const { data: attempt, error } = await service
      .from('auth_signup_attempts')
      .select('id, display_name, email, phone, phone_verified_at, email_code_hash, email_code_expires_at')
      .eq('id', signupId)
      .eq('status', 'phone_verified')
      .gt('expires_at', new Date().toISOString())
      .maybeSingle<SignupAttempt>()
    if (error) return NextResponse.json({ error: 'internal_error' }, { status: 500 })
    if (!attempt || !attempt.phone_verified_at) return NextResponse.json({ error: 'signup_expired' }, { status: 410 })
    if (!isVerificationCodeValid(code, attempt.email_code_hash, attempt.email_code_expires_at)) {
      await service.from('auth_signup_attempts').update({ email_attempts: 1 }).eq('id', signupId)
      return NextResponse.json({ error: 'invalid_code' }, { status: 400 })
    }

    const authPayload = {
      email: attempt.email,
      email_confirm: true,
      phone: attempt.phone,
      phone_confirm: true,
      user_metadata: { full_name: attempt.display_name },
      ...(secret.password ? { password: secret.password } : {}),
    }
    const { data: authData, error: authError } = await service.auth.admin.createUser(authPayload)
    if (authError || !authData.user) {
      if (isAlreadyRegistered(authError?.message) || authError?.code === 'email_exists') {
        return NextResponse.json({ error: 'email_exists' }, { status: 409 })
      }
      console.error('[auth/signup/verify-email] create user failed', authError)
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
      console.error('[auth/signup/verify-email] member code generation failed')
      return NextResponse.json({ error: 'internal_error' }, { status: 500 })
    }

    const verifiedAt = new Date().toISOString()
    const { error: profileError } = await service.from('users').upsert({
      id: authData.user.id,
      display_name: attempt.display_name,
      email: attempt.email,
      phone: attempt.phone,
      member_code: memberCode,
      phone_verified_at: attempt.phone_verified_at,
      email_verified_at: verifiedAt,
      profile_complete: true,
      updated_at: verifiedAt,
    }, { onConflict: 'id' })
    if (profileError) {
      await service.auth.admin.deleteUser(authData.user.id)
      if (profileError.code === '23505') return NextResponse.json({ error: 'identity_in_use' }, { status: 409 })
      console.error('[auth/signup/verify-email] profile creation failed', profileError)
      return NextResponse.json({ error: 'internal_error' }, { status: 500 })
    }

    const { data: linkData, error: linkError } = await service.auth.admin.generateLink({
      type: 'magiclink',
      email: attempt.email,
      options: { redirectTo: process.env.NEXT_PUBLIC_APP_URL || undefined },
    })
    if (linkError || !linkData?.properties?.hashed_token) {
      await service.auth.admin.deleteUser(authData.user.id)
      console.error('[auth/signup/verify-email] session link generation failed', linkError)
      return NextResponse.json({ error: 'internal_error' }, { status: 500 })
    }

    const { error: completeError } = await service
      .from('auth_signup_attempts')
      .update({ status: 'completed', completed_at: verifiedAt })
      .eq('id', signupId)
      .eq('status', 'phone_verified')
    if (completeError) {
      await service.auth.admin.deleteUser(authData.user.id)
      console.error('[auth/signup/verify-email] attempt completion failed', completeError)
      return NextResponse.json({ error: 'internal_error' }, { status: 500 })
    }

    const response = NextResponse.json({ ok: true, userId: authData.user.id, tokenHash: linkData.properties.hashed_token })
    clearSignupSecretCookie(response)
    return response
  } catch (error) {
    console.error('[auth/signup/verify-email] error', error)
    return NextResponse.json({ error: 'verification_failed' }, { status: 500 })
  }
}
