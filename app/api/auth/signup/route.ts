import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/service'
import { rateLimit, clientIp } from '@/lib/rate-limit'
import { normalizeHkPhone } from '@/lib/auth/profile'
import { validatePassword } from '@/lib/auth/password'
import { createVerificationCode, sendEmailVerificationCode } from '@/lib/auth/verification'
import { setSignupSecretCookie } from '@/lib/auth/signup-secret'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type SignupBody = { name?: unknown; email?: unknown; phone?: unknown; password?: unknown }

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

    if (!name || name.length > 100 || !email || !phone) {
      return NextResponse.json({ error: 'invalid_input' }, { status: 422 })
    }

    // A password is mandatory for email/phone registration (OAuth users never
    // reach this route). Revalidated server-side so a tampered client cannot
    // bypass the strength meter.
    const passwordCheck = validatePassword(password)
    if (!passwordCheck.ok) {
      return NextResponse.json({ error: 'weak_password', reasons: passwordCheck.reasons }, { status: 422 })
    }

    const okIp = await rateLimit('auth_signup_ip', `ip:${clientIp(request)}`, 10, 15 * 60)
    if (!okIp) return NextResponse.json({ error: 'rate_limited' }, { status: 429 })

    const service = getServiceSupabase()

    // ── Duplicate-check against auth_identities (the canonical identity ledger).
    // Only `verified = true` rows block registration — unverified rows from
    // prior migration or abandoned OTP attempts are ignored.
    const [{ data: emailRow, error: emailErr }, { data: phoneRow, error: phoneErr }] =
      await Promise.all([
        service
          .from('auth_identities')
          .select('user_id')
          .eq('provider', 'email')
          .eq('identifier', email)
          .eq('verified', true)
          .maybeSingle<{ user_id: string }>(),
        service
          .from('auth_identities')
          .select('user_id')
          .eq('provider', 'phone')
          .eq('identifier', phone)
          .eq('verified', true)
          .maybeSingle<{ user_id: string }>(),
      ])

    if (emailErr || phoneErr) {
      console.error('[auth/signup] auth_identities lookup failed', { emailErr, phoneErr })
      return NextResponse.json({ error: 'internal_error' }, { status: 500 })
    }

    if (emailRow) return NextResponse.json({ error: 'email_exists' }, { status: 409 })

    // Fallback: also check public.users.phone for accounts not yet migrated
    // to auth_identities (transition period safety net).
    if (!phoneRow) {
      const { data: legacyPhoneOwner } = await service
        .from('users')
        .select('id')
        .eq('phone', phone)
        .maybeSingle<{ id: string }>()
      if (legacyPhoneOwner) {
        return NextResponse.json({ error: 'phone_exists' }, { status: 409 })
      }
    } else {
      // auth_identities has a verified phone — block if owned by another user
      const { data: phoneOwner } = await service
        .from('users')
        .select('id')
        .eq('id', phoneRow.user_id)
        .maybeSingle<{ id: string }>()
      if (phoneOwner) {
        return NextResponse.json({ error: 'phone_exists' }, { status: 409 })
      }
    }

    // Email is proven first: the hashed code is stored on the attempt, and the
    // phone challenge is only issued once that code is redeemed.
    const emailCode = createVerificationCode()
    const { data: attempt, error: attemptError } = await service
      .from('auth_signup_attempts')
      .insert({
        display_name: name,
        email,
        phone,
        method: 'email',
        status: 'pending',
        email_code_hash: emailCode.hash,
        email_code_expires_at: emailCode.expiresAt,
      })
      .select('id')
      .single<{ id: string }>()
    if (attemptError || !attempt) {
      if (attemptError?.code === '23505') {
        return NextResponse.json({ error: 'identity_in_use' }, { status: 409 })
      }
      return NextResponse.json({ error: 'internal_error' }, { status: 500 })
    }

    try {
      await sendEmailVerificationCode({ to: email, code: emailCode.code, purpose: 'signup' })
      const response = NextResponse.json({ ok: true, signupId: attempt.id, step: 'email' })
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
