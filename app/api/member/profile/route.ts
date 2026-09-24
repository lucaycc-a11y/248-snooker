import { createClient } from '@/lib/supabase/server'

import { NextResponse } from 'next/server'

// ════════════════════════════════════════════════════════════════════════════
// GET /api/member/profile — Fetch member code for QR display
// ════════════════════════════════════════════════════════════════════════════

export async function GET() {
  const supabase = await createClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('users')
    .select('member_code')
    .eq('id', session.user.id)
    .single()

  return NextResponse.json({ member_code: profile?.member_code ?? '' })
}
