import { createClient } from '@/lib/supabase/server'

import { NextResponse } from 'next/server'

// ════════════════════════════════════════════════════════════════════════════
// POST /api/member/wallet-notify — Save wallet launch notification opt-in
// ════════════════════════════════════════════════════════════════════════════

export async function POST(req: Request) {
  const supabase = await createClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { notify } = await req.json()

  // Save to profiles.wallet_notify_opt_in (add column if needed)
  const { error } = await supabase
    .from('users')
    .update({ wallet_notify_opt_in: notify === true })
    .eq('id', session.user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
