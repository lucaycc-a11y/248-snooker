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

    // The phone identity ledger is the canonical verification source. The
    // legacy users.phone_verified_at column is still populated below for the
    // profile-complete constraint and older readers, but it must never decide
    // whether this submitted phone has actually been proven.
    const { data: existing } = await service
      .from('users')
      .select('member_code')
      .eq('id', user.id)
      .maybeSingle<{ member_code: string | null }>()

    const { data: verifiedIdentity, error: identityError } = await service
      .from('auth_identities')
      .select('verified_at')
      .eq('user_id', user.id)
      .eq('provider', 'phone')
      .eq('identifier', result.value.phone)
      .eq('verified', true)
      .maybeSingle<{ verified_at: string | null }>()

    if (identityError) {
      console.error('[profile/complete] phone identity lookup failed', {
        message: identityError.message,
        code: identityError.code,
        userId: user.id,
        submittedPhone: `***${result.value.phone.slice(-3)}`,
      })
      return NextResponse.json({ error: 'internal_error' }, { status: 500 })
    }

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
    if (!verifiedIdentity) {
      console.warn('[profile/complete] 422 phone_not_verified', {
        submittedPhone: `***${phone.slice(-3)}`,
        verificationSource: 'auth_identities',
        identityVerified: false,
        userId: user.id,
      })
      return NextResponse.json(
        { error: 'phone_not_verified', field: 'phone' },
        { status: 422 },
      )
    }

    // Older verified identities may lack a timestamp. Their verified flag is
    // authoritative; this fallback only fills the legacy profile projection.
    const phoneVerifiedAt = verifiedIdentity.verified_at ?? new Date().toISOString()

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
