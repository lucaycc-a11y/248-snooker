import { createRouteHandlerClient } from '@/lib/supabase/route-handler'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// GET /api/member/wallet/transactions
// Returns wallet credit transaction history with pagination
// Query params:
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
    const limitRaw = parseInt(searchParams.get('limit') ?? '50', 10)
    const offsetRaw = parseInt(searchParams.get('offset') ?? '0', 10)

    const limit = Math.min(Math.max(1, limitRaw), 100)
    const offset = Math.max(0, offsetRaw)

    // Query credits_ledger for wallet transaction history
    const { data: transactions, error: ledgerError, count } = await supabase
      .from('credits_ledger')
      .select('id, type, amount, balance_after, created_at, note', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (ledgerError) {
      console.error('[wallet/transactions] credits_ledger fetch error:', ledgerError)
      return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 })
    }

    const totalCount = count ?? 0
    const hasMore = offset + limit < totalCount
    const nextCursor = hasMore ? `${offset + limit}` : undefined

    return NextResponse.json({
      transactions: transactions ?? [],
      hasMore,
      nextCursor,
    })
  } catch (err) {
    console.error('[wallet/transactions] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
