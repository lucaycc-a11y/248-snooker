import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@/lib/supabase/route-handler'
import type { WalletApiResponse, WalletLedgerItem } from '@/lib/member-contracts'
import { parseConvertNote } from '@/lib/member-format'

const LEDGER_PAGE_SIZE = 20

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const supabase = await createRouteHandlerClient()

  // Auth check
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const userId = user.id
  const { searchParams } = new URL(request.url)
  const filter = searchParams.get('filter') // 'use' | 'in'
  const cursor = searchParams.get('cursor')

  try {
    // Fetch balance
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('credits, member_code')
      .eq('id', userId)
      .single()

    if (userError || !user) {
      throw new Error('Failed to fetch user balance')
    }

    // Calculate held amount
    const { data: holds, error: holdsError } = await supabase
      .from('credit_holds')
      .select('credits')
      .eq('user_id', userId)
      .eq('status', 'held')

    if (holdsError) {
      throw new Error('Failed to fetch credit holds')
    }

    const held = holds?.reduce((sum: number, h: { credits: number }) => sum + h.credits, 0) ?? 0
    const available = user.credits - held

    // Fetch ledger with filters
    let query = supabase
      .from('credits_ledger')
      .select('id, type, amount, balance_after, created_at, note, reference_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(LEDGER_PAGE_SIZE + 1)

    // Apply filter
    if (filter === 'use') {
      query = query.lt('amount', 0)
    } else if (filter === 'in') {
      query = query.gt('amount', 0)
    }

    // Apply cursor
    if (cursor) {
      query = query.lt('created_at', cursor)
    }

    const { data: ledgerRows, error: ledgerError } = await query

    if (ledgerError) {
      throw new Error('Failed to fetch ledger')
    }

    // Check if there are more pages
    const hasMore = ledgerRows.length > LEDGER_PAGE_SIZE
    const items = ledgerRows.slice(0, LEDGER_PAGE_SIZE)
    const nextCursor = hasMore ? items[items.length - 1].created_at : null

    // Enrich ledger items with booking data
    const bookingIds = items
      .filter((r: any) => ['redeem', 'refund', 'reversal'].includes(r.type) && r.reference_id)
      .map((r: any) => r.reference_id as string)

    let bookingsMap = new Map<string, any>()

    if (bookingIds.length > 0) {
      const { data: bookings } = await supabase
        .from('bookings')
        .select('id, booking_reference, human_code, table_number, date, start_time, end_time')
        .in('id', bookingIds)

      if (bookings) {
        bookings.forEach((b: any) => bookingsMap.set(b.id, b))
      }
    }

    // Map to contract shape
    const ledgerItems: WalletLedgerItem[] = items.map((row: any) => {
      const booking = row.reference_id ? bookingsMap.get(row.reference_id) : null

      return {
        id: row.id,
        type: row.type,
        amount: row.amount,
        balanceAfter: row.balance_after,
        createdAt: row.created_at,
        note: row.note,
        pointsConverted: row.type === 'convert' ? parseConvertNote(row.note) : null,
        booking: booking
          ? {
              id: booking.id,
              reference: booking.booking_reference,
              humanCode: booking.human_code,
              tableNumber: booking.table_number,
              date: booking.date,
              startTime: booking.start_time,
              endTime: booking.end_time,
            }
          : null,
      }
    })

    // Flatten response structure
    const response: WalletApiResponse = {
      balance: user.credits,
      currency: 'HKD',
      held,
      available,
      memberCode: user.member_code ?? '',
      ledger: {
        items: ledgerItems,
        hasMore,
        nextCursor,
      },
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Wallet API error:', error)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
