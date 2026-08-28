import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/service'
import { normalizeHkPhone } from '@/lib/auth/profile'
import { rateLimit, clientIp } from '@/lib/rate-limit'
import { verifyEngagelabOtp } from '@/lib/engagelab/otp'
import { createVerificationCode, sendEmailVerificationCode } from '@/lib/auth/verification'

type Body = { signupId?: unknown; phone?: unknown; messageId?: unknown; code?: unknown }
type SignupAttempt = {
  id: string
  email: string
  phone: string
  sms_message_id: string | null
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as Body | null
    const signupId = typeof body?.signupId === 'string' ? body.signupId : ''
    const phone = typeof body?.phone === 'string' ? body.phone : ''
    const messageId = typeof body?.messageId === 'string' ? body.messageId : ''
    const code = typeof body?.code === 'string' ? body.code.trim() : ''
    const submittedPhone = normalizeHkPhone(phone)
    if (!submittedPhone || !signupId || !messageId || !code) return NextResponse.json({ error: 'invalid_input' }, { status: 422 })

    const okIp = await rateLimit('auth_signup_verify_ip', `ip:${clientIp(request)}`, 10, 15 * 60)
    if (!okIp) return NextResponse.json({ error: 'rate_limited' }, { status: 429 })

    const service = getServiceSupabase()
    const { data: attempt, error: lookupError } = await service
      .from('auth_signup_attempts')
      .select('id, email, phone, sms_message_id')
      .eq('id', signupId)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .maybeSingle<SignupAttempt>()
    if (lookupError) return NextResponse.json({ error: 'internal_error' }, { status: 500 })
    if (!attempt || attempt.phone !== submittedPhone || attempt.sms_message_id !== messageId) {
      return NextResponse.json({ error: 'signup_expired' }, { status: 410 })
    }

    const verified = await verifyEngagelabOtp(messageId, code)
    if (verified.verified !== true) return NextResponse.json({ error: 'invalid_code' }, { status: 400 })

    const emailCode = createVerificationCode()
    const { data, error } = await service
      .from('auth_signup_attempts')
      .update({
        phone_verified_at: new Date().toISOString(),
        email_code_hash: emailCode.hash,
        email_code_expires_at: emailCode.expiresAt,
        status: 'phone_verified',
      })
      .eq('id', attempt.id)
      .eq('status', 'pending')
      .select('id, email')
      .maybeSingle<{ id: string; email: string }>()
    if (error) return NextResponse.json({ error: 'internal_error' }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'signup_expired' }, { status: 410 })

    try {
      await sendEmailVerificationCode({ to: data.email, code: emailCode.code, purpose: 'signup' })
    } catch (error) {
      await service.from('auth_signup_attempts').update({ status: 'expired' }).eq('id', data.id)
      console.error('[auth/signup/verify-phone] email delivery failed', error)
      return NextResponse.json({ error: 'send_failed' }, { status: 502 })
    }
    return NextResponse.json({ ok: true, signupId: data.id, email: data.email })
  } catch (error) {
    console.error('[auth/signup/verify-phone] error', error)
    return NextResponse.json({ error: 'verification_failed' }, { status: 500 })
  }
}
