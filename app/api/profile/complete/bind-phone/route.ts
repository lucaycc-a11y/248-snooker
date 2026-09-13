import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { normalizeHkPhone } from '@/lib/auth/profile'
import { bindVerifiedPhone } from '@/lib/auth/phone-binding'
import { rateLimit, clientIp } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic' // reads auth cookies — never prerender

// POST /api/profile/complete/bind-phone  { phone }
// Bridges Supabase native Phone Auth to the canonical identity ledger.
//
// The client now redeems its OTP with supabase.auth.verifyOtp() directly, which
// writes auth.users.phone + phone_confirmed_at but knows nothing about
// public.auth_identities — and /api/profile/complete gates on a verified
// auth_identities row, so without this step every completion 422s with
// phone_not_verified.
//
// The proof of verification is taken from the SESSION, never from the request
// body: auth.getUser() is a fresh GoTrue read, so phone_confirmed_at being set
// and auth.users.phone matching the submitted number can only happen if
// verifyOtp actually succeeded for this user. A caller who POSTs an unverified
// number gets 422 — the body cannot manufacture verification.
export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      const status = (authError as { status?: number } | null)?.status
      console.error('[profile/bind-phone] auth.getUser failed', {
        message: authError?.message ?? 'missing session',
        status,
      })
      // Same split as profile/complete: unreachable GoTrue is retryable (503),
      // a genuinely absent session is not (401).
      if (authError && (status === undefined || status >= 500)) {
        return NextResponse.json({ error: 'auth_unavailable' }, { status: 503 })
      }
      return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })
    }

    // Session-authenticated, but still throttled: binding runs no OTP send, yet
    // an unbounded loop here would be a free probe against the phone-taken check.
    const okIp = await rateLimit('profile_bind_phone_ip', `ip:${clientIp(req)}`, 20, 15 * 60)
    if (!okIp) {
      return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
    }

    const body = (await req.json().catch(() => null)) as { phone?: unknown } | null
    const phone = normalizeHkPhone(typeof body?.phone === 'string' ? body.phone : '')
    if (!phone) {
      return NextResponse.json({ error: 'phone_invalid', field: 'phone' }, { status: 422 })
    }

    // The actual gate. Both conditions come from GoTrue, not the client.
    const sessionPhone = user.phone ? `+${user.phone.replace(/^\+/, '')}` : ''
    const phoneConfirmedAt = (user as { phone_confirmed_at?: string | null }).phone_confirmed_at

    if (!phoneConfirmedAt || sessionPhone !== phone) {
      console.warn('[profile/bind-phone] 422 phone_not_verified', {
        submittedPhone: `***${phone.slice(-3)}`,
        sessionPhone: sessionPhone ? `***${sessionPhone.slice(-3)}` : '(empty)',
        phoneConfirmed: Boolean(phoneConfirmedAt),
        userId: user.id,
      })
      return NextResponse.json({ error: 'phone_not_verified', field: 'phone' }, { status: 422 })
    }

    // Service-role write to the ledger. bindVerifiedPhone owns the uniqueness
    // check and the insert/update branching for the partial unique index.
    const result = await bindVerifiedPhone(user.id, phone)
    if (!result.ok) {
      if (result.error === 'phone_taken') {
        return NextResponse.json({ error: 'phone_taken', field: 'phone' }, { status: 409 })
      }
      if (result.error === 'phone_invalid') {
        return NextResponse.json({ error: 'phone_invalid', field: 'phone' }, { status: 422 })
      }
      console.error('[profile/bind-phone] bind failed', { userId: user.id, error: result.error })
      return NextResponse.json({ error: 'bind_failed' }, { status: 500 })
    }

    console.log('[profile/bind-phone] success', {
      userId: user.id,
      alreadyVerified: result.alreadyVerified ?? false,
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[profile/bind-phone] unhandled', {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
