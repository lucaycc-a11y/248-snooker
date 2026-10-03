import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@/lib/supabase/route-handler'
import type {
  PointsTransactionItem,
  PointsTransactionsResponse,
  ErrorResponse,
} from '@/lib/member-contracts'
import { parseConvertNote } from '@/lib/member-format'

/**
 * GET /api/member/points/transactions?cursor=<timestamp>
 *
 * Paginated transactions endpoint (used by "Load More" button).
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createRouteHandlerClient()

    // 1. Check auth
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json<ErrorResponse>(
        { error: 'unauthorized' },
        { status: 401 }
      )
    }

    const userId = session.user.id
    const searchParams = request.nextUrl.searchParams
    const cursor = searchParams.get('cursor')

    // 2. Fetch transactions
    const transactions = await fetchTransactions(supabase, userId, cursor)

    return NextResponse.json(transactions)
  } catch (err) {
    console.error('GET /api/member/points/transactions error:', err)
    return NextResponse.json<ErrorResponse>(
      { error: 'server_error' },
      { status: 500 }
    )
  }
}

/**
 * Fetch and merge points_ledger + credits_ledger (convert only)
 * Returns up to 20 items, newest first.
 */
async function fetchTransactions(
  supabase: any,
  userId: string,
  cursor: string | null
): Promise<PointsTransactionsResponse> {
  const limit = 20
  let pointsQuery = supabase
    .from('points_ledger')
    .select('id, type, amount, created_at, note, booking_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit * 2) // Over-fetch to merge with credits

  if (cursor) {
    pointsQuery = pointsQuery.lt('created_at', cursor)
  }

  const { data: pointsRows, error: pointsError } = await pointsQuery

  if (pointsError) {
    console.error('Failed to fetch points_ledger:', pointsError)
    throw pointsError
  }

  // Fetch credits_ledger (convert only)
  let creditsQuery = supabase
    .from('credits_ledger')
    .select('id, type, amount, created_at, note')
    .eq('user_id', userId)
    .eq('type', 'convert')
    .order('created_at', { ascending: false })
    .limit(limit * 2)

  if (cursor) {
    creditsQuery = creditsQuery.lt('created_at', cursor)
  }

  const { data: creditsRows, error: creditsError } = await creditsQuery

  if (creditsError) {
    console.error('Failed to fetch credits_ledger:', creditsError)
    throw creditsError
  }

  // Merge and sort
  const merged: PointsTransactionItem[] = []

  // Map points_ledger rows
  for (const row of pointsRows || []) {
    merged.push({
      id: row.id,
      source: 'points',
      type: row.type,
      points: row.amount,
      depositedHkd: null,
      paidHkd: null,
      createdAt: row.created_at,
      note: row.note || '',
      bookingReference: null,
    })
  }

  // Map credits_ledger (convert) rows
  for (const row of creditsRows || []) {
    const convertedPoints = parseConvertNote(row.note || '')
    if (convertedPoints !== null) {
      merged.push({
        id: row.id,
        source: 'credits',
        type: 'convert',
        points: -convertedPoints,
        depositedHkd: row.amount,
        paidHkd: null,
        createdAt: row.created_at,
        note: row.note || '',
        bookingReference: null,
      })
    }
  }

  // Sort by created_at descending
  merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  // Take first `limit` items
  const items = merged.slice(0, limit)
  const hasMore = merged.length > limit
  const nextCursor = hasMore && items.length > 0 ? items[items.length - 1].createdAt : null

  return {
    items,
    hasMore,
    nextCursor,
  }
}
