import { createRouteHandlerClient } from '@/lib/supabase/route-handler'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// GET /api/member/points/transactions
// Returns points ledger entries with pagination and optional filters
// Query params:
//   - filter: 'all' | 'earn' | 'wallet' | 'back' (default: 'all')
//   - limit: number (default: 50, max: 100)
//   - offset: number (default: 0)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createRouteHandlerClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = new URL(request.url).searchParams
    const filter = searchParams.get('filter') ?? 'all'
    const limitRaw = parseInt(searchParams.get('limit') ?? '50', 10)
    const offsetRaw = parseInt(searchParams.get('offset') ?? '0', 10)

    const limit = Math.min(Math.max(1, limitRaw), 100)
    const offset = Math.max(0, offsetRaw)

    if (!['all', 'earn', 'wallet', 'back'].includes(filter)) {
      return NextResponse.json({ error: 'Invalid filter' }, { status: 400 })
    }

    // Build query for points_ledger
    let query = supabase
      .from('points_ledger')
      .select('id, type, amount, balance_after, created_at, reference_id, note', { count: 'exact' })
      .eq('user_id', user.id)

    // Apply filter
    if (filter === 'earn') {
      query = query.in('type', ['booking_earned', 'referral', 'admin_grant'])
    } else if (filter === 'wallet') {
      query = query.eq('type', 'converted_to_credits')
    } else if (filter === 'back') {
      query = query.eq('type', 'chargeback')
    }

    query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1)

    const { data: ledger, error: ledgerError, count } = await query

    if (ledgerError) {
      console.error('[points/transactions] ledger fetch error:', ledgerError)
      return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 })
    }

    const totalCount = count ?? 0
    const hasMore = offset + limit < totalCount
    const nextCursor = hasMore ? `${offset + limit}` : undefined

    return NextResponse.json({
      transactions: ledger ?? [],
      hasMore,
      nextCursor,
    })
  } catch (err) {
    console.error('[points/transactions] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
