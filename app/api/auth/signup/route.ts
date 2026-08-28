import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/service'
import { rateLimit, clientIp } from '@/lib/rate-limit'
import { normalizeHkPhone } from '@/lib/auth/profile'
import { sendEngagelabOtp } from '@/lib/engagelab/otp'
import { setSignupSecretCookie } from '@/lib/auth/signup-secret'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type SignupBody = { name?: unknown; email?: unknown; phone?: unknown; password?: unknown }

type ExistingRow = { id: string }

function normalizedEmail(value: unknown): string | null {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return email && email.length <= 254 && EMAIL_RE.test(email) ? email : null
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as SignupBody | null
    const name = typeof body?.name === 'string' ? body.name.trim() : ''
    const email = normalizedEmail(body?.email)
    const phone = normalizeHkPhone(typeof body?.phone === 'string' ? body.phone : '')
    const password = typeof body?.password === 'string' ? body.password : ''

    if (!name || name.length > 100 || !email || !phone || (password && password.length < 6)) {
      return NextResponse.json({ error: 'invalid_input' }, { status: 422 })
    }

    const okIp = await rateLimit('auth_signup_ip', `ip:${clientIp(request)}`, 10, 15 * 60)
    if (!okIp) return NextResponse.json({ error: 'rate_limited' }, { status: 429 })

    const service = getServiceSupabase()
    const [{ data: emailOwner, error: emailError }, { data: phoneOwner, error: phoneError }] = await Promise.all([
      service.from('users').select('id').eq('email', email).maybeSingle<ExistingRow>(),
      service.from('users').select('id').eq('phone', phone).maybeSingle<ExistingRow>(),
    ])
    if (emailError || phoneError) return NextResponse.json({ error: 'internal_error' }, { status: 500 })
    if (emailOwner) return NextResponse.json({ error: 'email_exists' }, { status: 409 })
    if (phoneOwner) return NextResponse.json({ error: 'phone_exists' }, { status: 409 })

    const { data: attempt, error: attemptError } = await service
      .from('auth_signup_attempts')
      .insert({ display_name: name, email, phone, status: 'pending' })
      .select('id')
      .single<{ id: string }>()
    if (attemptError || !attempt) {
      if (attemptError?.code === '23505') {
        return NextResponse.json({ error: 'identity_in_use' }, { status: 409 })
      }
      return NextResponse.json({ error: 'internal_error' }, { status: 500 })
    }

    try {
      const sms = await sendEngagelabOtp(phone, 'zh_HK')
      const { error: updateError } = await service
        .from('auth_signup_attempts')
        .update({ sms_message_id: sms.message_id })
        .eq('id', attempt.id)
      if (updateError) throw updateError
      const response = NextResponse.json({ ok: true, signupId: attempt.id, messageId: sms.message_id, channel: sms.send_channel })
      setSignupSecretCookie(response, { signupId: attempt.id, password })
      return response
    } catch (error) {
      await service.from('auth_signup_attempts').update({ status: 'expired' }).eq('id', attempt.id)
      console.error('[auth/signup] verification delivery failed', error)
      return NextResponse.json({ error: 'send_failed' }, { status: 502 })
    }
  } catch (error) {
    console.error('[auth/signup] error', error)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
