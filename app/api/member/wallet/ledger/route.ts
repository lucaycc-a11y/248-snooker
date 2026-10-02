import { createRouteHandlerClient } from '@/lib/supabase/route-handler'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createRouteHandlerClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch user's current wallet balance
    const { data: userData, error: userDataError } = await supabase
      .from('users')
      .select('p_credits')
      .eq('id', user.id)
      .single()

    if (userDataError) {
      console.error('[wallet/ledger] user fetch error:', userDataError)
      return NextResponse.json({ error: 'Failed to fetch user data' }, { status: 500 })
    }

    const balance = userData?.p_credits ?? 0

    // Fetch ledger entries, newest first
    const { data: ledger, error: ledgerError } = await supabase
      .from('credits_ledger')
      .select('id, type, amount, balance_after, created_at, reference, description')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100)

    if (ledgerError) {
      console.error('[wallet/ledger] ledger fetch error:', ledgerError)
      return NextResponse.json({ error: 'Failed to fetch ledger' }, { status: 500 })
    }

    return NextResponse.json({
      balance,
      ledger: ledger ?? [],
    })
  } catch (err) {
    console.error('[wallet/ledger] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
