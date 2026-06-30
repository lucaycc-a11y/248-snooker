import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceSupabase } from '@/lib/supabase/service'
import { validateProfile } from '@/lib/auth/profile'

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
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })
    }

    const body = await req.json().catch(() => null)
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

    // Service-role UPSERT (not update): a brand-new SMS user verifies OTP
    // client-side without passing through /auth/callback, so they may have no
    // users row yet — an update would silently affect 0 rows. Upsert with a
    // partial column set is proven safe here (the OAuth callback does the same),
    // so other columns fall back to their DB defaults (tier, points, …).
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
      console.error('profile_complete_update_error', error.message)
      return NextResponse.json({ error: 'update_failed' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, profile: result.value })
  } catch (err) {
    console.error('profile_complete_error', (err as Error).message)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
