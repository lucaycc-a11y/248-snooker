import { createClient } from '@/lib/supabase/server'

import { NextResponse } from 'next/server'

// ════════════════════════════════════════════════════════════════════════════
// POST /api/member/wallet-notify — Save wallet launch notification opt-in
// ════════════════════════════════════════════════════════════════════════════

export async function POST(req: Request) {
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

  const { notify } = await req.json()

  // Save to profiles.wallet_notify_opt_in (add column if needed)
  const { error } = await supabase
    .from('users')
    .update({ wallet_notify_opt_in: notify === true })
    .eq('id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
