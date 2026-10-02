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
      .select('credits')
      .eq('id', user.id)
      .single()

    if (userDataError) {
      console.error('[wallet/ledger] user fetch error:', userDataError)
      return NextResponse.json({ error: 'Failed to fetch user data' }, { status: 500 })
    }

    const balance = userData?.credits ?? 0

    // Fetch ledger entries with booking details, newest first (fallback to empty if table doesn't exist)
    let ledger: unknown[] = []
    try {
      const { data: ledgerData, error: ledgerError } = await supabase
        .from('credits_ledger')
        .select('id, type, amount, balance_after, created_at, reference_id, note, booking_id, bookings(id, date, start_time, period)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100)

      if (!ledgerError) {
        ledger = ledgerData ?? []
      } else {
        console.error('[wallet/ledger] ledger fetch error:', ledgerError)
      }
    } catch (err) {
      console.error('[wallet/ledger] ledger fetch exception:', err)
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
