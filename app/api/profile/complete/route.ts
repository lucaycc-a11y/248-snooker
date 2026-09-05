import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceSupabase } from '@/lib/supabase/service'
import { validateProfile, normalizeHkPhone } from '@/lib/auth/profile'
import { generateMemberCode } from '@/lib/member/planetSystem'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic' // reads auth cookies — never prerender

// POST /api/profile/complete  { name, email, phone }
// The authoritative server-side half of the mandatory profile-completion step.
// Requires a valid session; re-validates every field with the SAME validator the
// client uses (never trusts client-side validation); writes the normalized values
// and flips profile_complete=true. Idempotent — re-submitting just overwrites.
export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      // Never swallow the auth error again — swallowing it is exactly what forced
      // us to guess last time. Log the real GoTrue message/status so Vercel shows
      // WHY this was unauthenticated, not just a bare 401.
      const status = (authError as { status?: number } | null)?.status
      console.error('[profile/complete] auth.getUser failed:', {
        message: authError?.message ?? 'no user, no error (missing/partial session cookie)',
        status,
      })
      // Split a retryable backend failure from a genuine missing/expired session:
      // a 5xx or network-class error (no status) means GoTrue was unreachable →
      // 503 so the client can retry; anything else is truly unauthenticated → 401.
      if (authError && (status === undefined || status >= 500)) {
        return NextResponse.json({ error: 'auth_unavailable' }, { status: 503 })
      }
      return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })
    }

    const body = await req.json().catch(() => null)
    console.log('[profile/complete] attempt', { userId: user.id })
    console.log('[profile/complete] received body', {
      keys: Object.keys(body ?? {}),
      name: body?.name ? (body.name as string).slice(0, 2) + '***' : undefined,
      email: body?.email ? `***@${(body.email as string).split('@')[1]}` : undefined,
      phone: body?.phone ? `***${(body.phone as string).slice(-3)}` : undefined,
      bodyType: typeof body,
    })

    if (!normalizeHkPhone(body?.phone ?? '')) {
      console.warn('[profile/complete] 400 phone_invalid', {
        rawPhone: body?.phone ?? '(empty)',
        phoneType: typeof body?.phone,
      })
      return NextResponse.json({ error: '請提供有效的電話號碼' }, { status: 400 })
    }

    const result = validateProfile({
      name: body?.name,
      email: body?.email,
      phone: body?.phone,
    })
    if (!result.ok) {
      // 422: well-formed request, failed validation — client highlights `field`.
      console.warn('[profile/complete] 422 validation failed', {
        field: result.field,
        error: result.error,
        submittedName: body?.name ? (body.name as string).slice(0, 2) + '***' : '(empty)',
        submittedEmail: body?.email ? `***@${(body.email as string).split('@')[1]}` : '(empty)',
        submittedPhone: body?.phone ? `***${(body.phone as string).slice(-3)}` : '(empty)',
      })
      return NextResponse.json(
        { error: result.error, field: result.field },
        { status: 422 },
      )
    }

    console.log('[profile/complete] validation passed', {
      displayName: result.value.display_name.slice(0, 2) + '***',
      email: `***@${result.value.email.split('@')[1]}`,
      phone: `***${result.value.phone.slice(-3)}`,
    })

    const service = getServiceSupabase()

    // Verified-contact authority. The users_profile_complete_verified_chk
    // constraint (migration 20260829) makes "profile_complete = true" MEAN
    // "both contacts verified": the write below must carry non-null
    // email_verified_at and phone_verified_at or the upsert 500s. Those two
    // stamps must come from genuine verification, never from the submitted form:
    //
    //   email — the session email is the only trustable one. Every path that
    //   reaches this gate holds a Supabase session for a confirmed email (OAuth
    //   emails are auto-confirmed, the email-first signup stamps its own
    //   email_verified_at, SMS-recovered accounts were created email-first); an
    //   email in the form that differs from the session email is unverified by
    //   definition and must be rejected, not stamped.
    //
    //   phone — two honest sources only: (a) public.users.phone_verified_at
    //   already set for THIS phone by /api/otp/verify-binding (the new Google /
    //   Apple / typed-phone OTP step), or (b) auth.users.phone matching (a
    //   genuinely Supabase-SMS-verified number). Anything else — a bare typed
    //   phone with no OTP proof — gets a 422 phone_not_verified: this is the
    //   server-side half of C2 item 6, a direct POST here must never bypass the
    //   phone verification step.
    const { data: existing } = await service
      .from('users')
      .select('member_code, phone, phone_verified_at')
      .eq('id', user.id)
      .maybeSingle<{
        member_code: string | null
        phone: string | null
        phone_verified_at: string | null
      }>()

    const submittedEmail = result.value.email
    const sessionEmail = (user.email ?? '').toLowerCase()
    const emailMatchesSession = submittedEmail === sessionEmail
    if (!emailMatchesSession) {
      console.warn('[profile/complete] 422 email_not_verified', {
        submittedEmail: `***@${submittedEmail.split('@')[1]}`,
        sessionEmail: sessionEmail ? `***@${sessionEmail.split('@')[1]}` : '(empty)',
        userId: user.id,
      })
      return NextResponse.json(
        { error: 'email_not_verified', field: 'email' },
        { status: 422 },
      )
    }
    const emailVerifiedAt = (user as { email_confirmed_at?: string | null }).email_confirmed_at
      ?? new Date().toISOString()

    const phone = result.value.phone
    const rowAlreadyVerified =
      existing?.phone_verified_at != null && existing.phone === phone
    const authPhoneVerified = user.phone === phone
    const phoneVerifiedAt = rowAlreadyVerified
      ? existing.phone_verified_at
      : authPhoneVerified
        ? new Date().toISOString()
        : null
    if (!phoneVerifiedAt) {
      console.warn('[profile/complete] 422 phone_not_verified', {
        submittedPhone: `***${phone.slice(-3)}`,
        existingPhone: existing?.phone ? `***${existing.phone.slice(-3)}` : '(none)',
        existingPhoneVerified: existing?.phone_verified_at ?? '(null)',
        authUserPhone: user.phone ? `***${user.phone.slice(-3)}` : '(none)',
        rowAlreadyVerified,
        authPhoneVerified,
        userId: user.id,
      })
      return NextResponse.json(
        { error: 'phone_not_verified', field: 'phone' },
        { status: 422 },
      )
    }

    // Member code: SPACE8-{TIER}-{4chars}-{check}. New signups always start at
    // the Amateur tier (→ AMA). Codes are random, so this is idempotent by reuse:
    // if the user already has one, keep it — never reissue on a profile re-submit.
    // Only mint a new code for a first-time completion, retrying on the (tiny)
    // chance of a collision against an existing users.member_code.
    let memberCode = existing?.member_code ?? null
    if (!memberCode) {
      for (let attempt = 0; attempt < 5 && !memberCode; attempt++) {
        const candidate = generateMemberCode('amateur')
        const { data: clash } = await service
          .from('users')
          .select('id')
          .eq('member_code', candidate)
          .maybeSingle()
        if (!clash) memberCode = candidate
      }
      if (!memberCode) {
        console.error('[profile/complete] member code generation failed after retries', {
          userId: user.id,
        })
        return NextResponse.json({ error: 'update_failed' }, { status: 500 })
      }
    }

    const { error } = await service
      .from('users')
      .upsert(
        {
          id: user.id,
          display_name: result.value.display_name,
          email: result.value.email,
          phone,
          member_code: memberCode,
          email_verified_at: emailVerifiedAt,
          phone_verified_at: phoneVerifiedAt,
          profile_complete: true,
          onboarding_status: 'complete',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' },
      )
    if (error) {
      // Rich server-side log (message + Postgres code) so the next failure is
      // diagnosable from Vercel logs, but return a generic body — never leak DB
      // internals to the browser (security-backend skill).
      console.error('[profile/complete] upsert failed', {
        message: error.message,
        code: error.code,
        userId: user.id,
      })
      return NextResponse.json({ error: 'update_failed' }, { status: 500 })
    }

    console.log('[profile/complete] success', { userId: user.id, memberCode })
    return NextResponse.json({ ok: true, profile: result.value, memberCode })
  } catch (err) {
    const e = err as Error
    console.error('[profile/complete] error', { message: e.message, stack: e.stack })
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
