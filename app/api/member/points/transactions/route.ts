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

    // Build query for points_ledger (has 'points' column, not 'amount'; no balance_after)
    let pointsQuery = supabase
      .from('points_ledger')
      .select('id, type, points, created_at, reference_id, note', { count: 'exact' })
      .eq('user_id', user.id)

    // Apply filter
    if (filter === 'earn') {
      pointsQuery = pointsQuery.in('type', ['booking_earned', 'referral', 'admin_grant'])
    } else if (filter === 'wallet') {
      pointsQuery = pointsQuery.eq('type', 'converted_to_credits')
    } else if (filter === 'back') {
      pointsQuery = pointsQuery.eq('type', 'chargeback')
    }

    pointsQuery = pointsQuery.order('created_at', { ascending: false }).range(offset, offset + limit - 1)

    const { data: pointsLedger, error: pointsError, count: pointsCount } = await pointsQuery

    if (pointsError) {
      console.error('[points/transactions] points_ledger fetch error:', pointsError)
      return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 })
    }

    // For 'wallet' or 'all' filter, also fetch conversion rows from credits_ledger
    let creditsConversions: Array<{
      id: string
      type: string
      amount: number
      created_at: string
      reference_id: string | null
      note: string | null
    }> = []

    if (filter === 'wallet' || filter === 'all') {
      const { data: creditsData, error: creditsError } = await supabase
        .from('credits_ledger')
        .select('id, type, amount, created_at, reference_id, note')
        .eq('user_id', user.id)
        .eq('type', 'points_converted')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (creditsError) {
        console.error('[points/transactions] credits_ledger fetch error:', creditsError)
      } else {
        creditsConversions = creditsData ?? []
      }
    }

    // Merge and sort by created_at
    const allTransactions = [
      ...(pointsLedger ?? []).map(row => ({
        id: row.id,
        type: row.type,
        amount: row.points ?? 0,
        balance_after: null,
        created_at: row.created_at,
        reference_id: row.reference_id,
        note: row.note,
      })),
      ...creditsConversions.map(row => ({
        id: row.id,
        type: row.type,
        amount: row.amount,
        balance_after: null,
        created_at: row.created_at,
        reference_id: row.reference_id,
        note: row.note,
      })),
    ].sort((a, b) => new Date(b.created_at ?? '').getTime() - new Date(a.created_at ?? '').getTime())

    const totalCount = pointsCount ?? 0
    const hasMore = offset + limit < totalCount
    const nextCursor = hasMore ? `${offset + limit}` : undefined

    return NextResponse.json({
      transactions: allTransactions,
      hasMore,
      nextCursor,
    })
  } catch (err) {
    console.error('[points/transactions] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
