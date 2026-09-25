import { createClient } from '@/lib/supabase/server'

import { NextResponse } from 'next/server'

// ════════════════════════════════════════════════════════════════════════════
// GET /api/member/profile — Fetch member profile data
// Returns member_code, points, tier for client-side pages
// ════════════════════════════════════════════════════════════════════════════

export async function GET() {
  const supabase = await createClient()

  // SECURITY: Use getUser() not getSession() for auth decisions
  // getSession() reads cookies which can be forged; getUser() validates with auth server
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('member_code, points, tier')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  return NextResponse.json({
    member_code: profile.member_code ?? '',
    points: profile.points ?? 0,
    tier: profile.tier ?? 'amateur',
  })
}
