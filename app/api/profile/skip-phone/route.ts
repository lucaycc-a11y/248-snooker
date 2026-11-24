import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceSupabase } from '@/lib/supabase/service'
import { generateMemberCode } from '@/lib/member/planetSystem'
import { looseRpc } from '@/lib/member/pilot-rpc'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/profile/skip-phone { name, code }
// Space Pilot QR join only: lets a brand-new account continue with a VERIFIED EMAIL and no phone.
// The account becomes onboarding_status = 'email_only': it can use /member and Space Pilot, but it is
// NOT a complete profile, so every money path (requireCompleteProfile) and /book still demand a
// phone verified by OTP. The signup bonus is only granted on 'complete', so it waits for the phone.
//
// Guards: valid session with a confirmed email; the iPad join code must exist, be unexpired and
// unclaimed (or already claimed by this user); never downgrades an account that is already complete.
export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })

    const body: unknown = await req.json().catch(() => null)
    const o = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {}
    const name = typeof o.name === 'string' ? o.name.trim() : ''
    const code = typeof o.code === 'string' ? o.code.trim().toUpperCase() : ''
    if (name.length < 1 || name.length > 100) return NextResponse.json({ error: 'name_required' }, { status: 422 })
    if (!/^[A-Z0-9]{6,12}$/.test(code)) return NextResponse.json({ error: 'bad_code' }, { status: 400 })

    const email = (user.email ?? '').trim().toLowerCase()
    const emailConfirmedAt = (user as { email_confirmed_at?: string | null }).email_confirmed_at ?? null
    if (!email || !emailConfirmedAt) return NextResponse.json({ error: 'email_not_verified' }, { status: 422 })

    const service = getServiceSupabase()

    const joinRes = await looseRpc(service)('pilot_join_code_status', { p_code: code, p_user: user.id })
    if (joinRes.error) return NextResponse.json({ error: 'internal_error' }, { status: 500 })
    if (joinRes.data === 'not_found') return NextResponse.json({ error: 'not_found' }, { status: 404 })
    if (joinRes.data === 'expired') return NextResponse.json({ error: 'expired' }, { status: 410 })
    if (joinRes.data === 'already_used') return NextResponse.json({ error: 'already_used' }, { status: 409 })
    if (joinRes.data !== 'ok') return NextResponse.json({ error: 'internal_error' }, { status: 500 })

    const { data: existing } = await service
      .from('users')
      .select('member_code, onboarding_status, profile_complete')
      .eq('id', user.id)
      .maybeSingle<{ member_code: string | null; onboarding_status: string | null; profile_complete: boolean | null }>()
    if (existing?.onboarding_status === 'complete' || existing?.profile_complete === true) {
      return NextResponse.json({ ok: true, status: 'complete' })
    }

    const { data: emailOwner } = await service
      .from('users')
      .select('id')
      .ilike('email', email.replace(/[\\%_]/g, (c) => `\\${c}`))
      .neq('id', user.id)
      .limit(1)
      .maybeSingle<{ id: string }>()
    if (emailOwner) return NextResponse.json({ error: 'email_taken' }, { status: 422 })

    let memberCode = existing?.member_code ?? null
    for (let attempt = 0; attempt < 5 && !memberCode; attempt++) {
      const candidate = generateMemberCode('amateur')
      const { data: clash } = await service.from('users').select('id').eq('member_code', candidate).maybeSingle()
      if (!clash) memberCode = candidate
    }
    if (!memberCode) return NextResponse.json({ error: 'update_failed' }, { status: 500 })

    const { error } = await service.from('users').upsert(
      {
        id: user.id,
        display_name: name,
        email,
        member_code: memberCode,
        email_verified_at: emailConfirmedAt,
        profile_complete: false,
        onboarding_status: 'email_only',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    )
    if (error) {
      console.error('[profile/skip-phone] upsert failed', { message: error.message, code: error.code, userId: user.id })
      return NextResponse.json({ error: 'update_failed' }, { status: 500 })
    }
    return NextResponse.json({ ok: true, status: 'email_only' })
  } catch (err) {
    console.error('[profile/skip-phone] error', err instanceof Error ? err.message : 'unknown')
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
