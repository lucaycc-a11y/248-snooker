import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceSupabase } from '@/lib/supabase/service'
import { validateProfile, normalizeHkPhone } from '@/lib/auth/profile'

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

    if (!normalizeHkPhone(body?.phone ?? '')) {
      return NextResponse.json({ error: '請提供有效嘅電話號碼' }, { status: 400 })
    }

    const result = validateProfile({
      name: body?.name,
      email: body?.email,
      phone: body?.phone,
    })
    if (!result.ok) {
      // 422: well-formed request, failed validation — client highlights `field`.
      return NextResponse.json(
        { error: result.error, field: result.field },
        { status: 422 },
      )
    }

    // Authoritative phone-possession check: the client-side flow (SMS sign-in,
    // OR ProfileCompletion's supabase.auth.updateUser + verifyOtp(type:
    // 'phone_change') for Apple/Google/Email users) is the ONLY way
    // auth.users.phone gets set to a Supabase-verified number. Never trust a
    // phone string arriving in the request body on its own — require it to
    // match the verified auth.users.phone, so a client can't just POST an
    // arbitrary unverified number and skip the OTP round-trip entirely.
    // NOTE: Supabase stores auth.users.phone in bare E.164 (no leading '+',
    // e.g. "85291234567"), while normalizeHkPhone() returns "+852XXXXXXXX" —
    // strip the '+' before comparing, or this rejects every legitimately
    // verified user.
    const verifiedPhone = (user.phone ?? '').replace(/^\+/, '')
    if (result.value.phone.replace(/^\+/, '') !== verifiedPhone) {
      console.error('[profile/complete] phone_not_verified', {
        userId: user.id,
        authPhoneSet: Boolean(user.phone),
      })
      return NextResponse.json(
        { error: 'phone_not_verified', field: 'phone' },
        { status: 422 },
      )
    }

    // Service-role UPSERT (not update): a brand-new SMS user verifies OTP
    // client-side without passing through /auth/callback, so they may have no
    // users row yet — an update would silently affect 0 rows. Service-role also
    // bypasses RLS, so the UPSERT never needs a matching INSERT *and* UPDATE
    // policy to line up (a subtle way a cookie-bound client fails on new rows).
    // NOTE: this write can only 500 — auth is fully settled above, so a 401 can
    // never originate from here regardless of which client performs the write.
    const service = getServiceSupabase()
    const { error } = await service
      .from('users')
      .upsert(
        {
          id: user.id,
          display_name: result.value.display_name,
          email: result.value.email,
          phone: result.value.phone,
          profile_complete: true,
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

    console.log('[profile/complete] success', { userId: user.id })
    return NextResponse.json({ ok: true, profile: result.value })
  } catch (err) {
    const e = err as Error
    console.error('[profile/complete] error', { message: e.message, stack: e.stack })
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
