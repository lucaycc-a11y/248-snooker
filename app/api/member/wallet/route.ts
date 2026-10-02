import { createRouteHandlerClient } from '@/lib/supabase/route-handler'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// GET /api/member/wallet
// Returns wallet balance, held amount, and available credits
export async function GET(request: NextRequest) {
  try {
    const supabase = await createRouteHandlerClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch current balance
    const { data: userData, error: userDataError } = await supabase
      .from('users')
      .select('credits')
      .eq('id', user.id)
      .single()

    if (userDataError) {
      console.error('[wallet] user fetch error:', userDataError)
      return NextResponse.json({ error: 'Failed to fetch user data' }, { status: 500 })
    }

    const balance = userData?.credits ?? 0

    // Fetch held amount from pending checkouts
    const { data: held, error: heldError } = await supabase
      .rpc('get_held_credits', { p_user_id: user.id })

    if (heldError) {
      console.error('[wallet] held credits fetch error:', heldError)
      return NextResponse.json({ error: 'Failed to fetch held credits' }, { status: 500 })
    }

    const heldAmount = held ?? 0
    const available = Math.max(0, balance - heldAmount)

    return NextResponse.json({
      balance,
      held: heldAmount,
      available,
    })
  } catch (err) {
    console.error('[wallet] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
