// Registration step 1 of 2: redeem the hashed email code, then issue the SMS
// challenge for the phone number captured at signup. No Supabase Auth user is
// created here — that happens in verify-phone once both contacts are proven.
import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/service'
import { rateLimit, clientIp } from '@/lib/rate-limit'
import { isVerificationCodeValid } from '@/lib/auth/verification'
import { canVerifyEmail, type SignupStatus } from '@/lib/auth/signup-state'
import { decryptSignupSecret, signupSecretFromCookieHeader } from '@/lib/auth/signup-secret'
import { sendEngagelabOtp } from '@/lib/engagelab/otp'

type Body = { signupId?: unknown; code?: unknown }
type SignupAttempt = {
  id: string
  email: string
  phone: string
  status: SignupStatus
  email_attempts: number
  email_code_hash: string | null
  email_code_expires_at: string | null
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_EMAIL_ATTEMPTS = 5

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as Body | null
    const signupId = typeof body?.signupId === 'string' ? body.signupId : ''
    const code = typeof body?.code === 'string' ? body.code.trim() : ''
    if (!signupId || !/^\d{6}$/.test(code)) return NextResponse.json({ error: 'invalid_input' }, { status: 422 })

    const okIp = await rateLimit('auth_signup_email_verify_ip', `ip:${clientIp(request)}`, 10, 15 * 60)
    if (!okIp) return NextResponse.json({ error: 'rate_limited' }, { status: 429 })

    const secret = decryptSignupSecret(signupSecretFromCookieHeader(request.headers.get('cookie')))
    if (!secret || secret.signupId !== signupId) return NextResponse.json({ error: 'signup_expired' }, { status: 410 })

    const service = getServiceSupabase()
    const { data: attempt, error } = await service
      .from('auth_signup_attempts')
      .select('id, email, phone, status, email_attempts, email_code_hash, email_code_expires_at')
      .eq('id', signupId)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle<SignupAttempt>()
    if (error) return NextResponse.json({ error: 'internal_error' }, { status: 500 })
    if (!attempt || !canVerifyEmail(attempt.status)) return NextResponse.json({ error: 'signup_expired' }, { status: 410 })

    if (attempt.email_attempts >= MAX_EMAIL_ATTEMPTS) {
      await service.from('auth_signup_attempts').update({ status: 'expired' }).eq('id', signupId)
      return NextResponse.json({ error: 'too_many_attempts' }, { status: 429 })
    }

    if (!isVerificationCodeValid(code, attempt.email_code_hash, attempt.email_code_expires_at)) {
      await service
        .from('auth_signup_attempts')
        .update({ email_attempts: attempt.email_attempts + 1 })
        .eq('id', signupId)
      return NextResponse.json({ error: 'invalid_code' }, { status: 400 })
    }

    // Consume the email code as part of the same conditional update so a replayed
    // request cannot advance the attempt twice.
    const { data: advanced, error: advanceError } = await service
      .from('auth_signup_attempts')
      .update({
        email_verified_at: new Date().toISOString(),
        email_code_hash: null,
        email_code_expires_at: null,
        status: 'email_verified',
      })
      .eq('id', signupId)
      .eq('status', 'pending')
      .select('id, phone')
      .maybeSingle<{ id: string; phone: string }>()
    if (advanceError) return NextResponse.json({ error: 'internal_error' }, { status: 500 })
    if (!advanced) return NextResponse.json({ error: 'signup_expired' }, { status: 410 })

    try {
      const sms = await sendEngagelabOtp(advanced.phone, 'zh_HK')
      const { error: updateError } = await service
        .from('auth_signup_attempts')
        .update({ sms_message_id: sms.message_id })
        .eq('id', advanced.id)
      if (updateError) throw updateError
      return NextResponse.json({ ok: true, signupId: advanced.id, step: 'phone', messageId: sms.message_id, channel: sms.send_channel })
    } catch (smsError) {
      await service.from('auth_signup_attempts').update({ status: 'expired' }).eq('id', advanced.id)
      console.error('[auth/signup/verify-email] sms delivery failed', smsError)
      return NextResponse.json({ error: 'send_failed' }, { status: 502 })
    }
  } catch (error) {
    console.error('[auth/signup/verify-email] error', error)
    return NextResponse.json({ error: 'verification_failed' }, { status: 500 })
  }
}
