import { createRouteHandlerClient } from '@/lib/supabase/route-handler'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

type LedgerType = 'convert' | 'signup' | 'topup' | 'redeem' | 'refund' | 'reversal' | 'manual'

type LedgerRow = {
  id: string
  user_id: string
  amount: number
  type: LedgerType
  reference_id: string | null
  note: string | null
  created_at: string
  balance_after: number
  actor_id: string | null
}

type BookingRow = {
  id: string
  booking_reference: string
  human_code: string | null
  date: string
  start_time: string
  table_number: number
}

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

    // Fetch ledger entries with REAL columns only
    const { data: ledgerData, error: ledgerError } = await supabase
      .from('credits_ledger')
      .select('id, user_id, amount, type, reference_id, note, created_at, balance_after, actor_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100)

    if (ledgerError) {
      console.error('[wallet/ledger] ledger fetch error:', ledgerError)
      return NextResponse.json({ error: 'Failed to fetch ledger' }, { status: 500 })
    }

    const ledger = (ledgerData ?? []) as LedgerRow[]

    // Extract booking IDs from reference_id where type suggests booking relation
    const bookingTypes: LedgerType[] = ['redeem', 'refund', 'reversal']
    const bookingIds = ledger
      .filter((row) => bookingTypes.includes(row.type) && row.reference_id)
      .map((row) => row.reference_id as string)
      .filter((id, idx, arr) => arr.indexOf(id) === idx) // unique

    // Fetch related bookings in a second query (RLS applies via user session)
    let bookingsMap: Record<string, BookingRow> = {}
    if (bookingIds.length > 0) {
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select('id, booking_reference, human_code, date, start_time, table_number')
        .in('id', bookingIds)

      if (!bookingsError && bookingsData) {
        bookingsMap = Object.fromEntries(
          (bookingsData as BookingRow[]).map((b) => [b.id, b])
        )
      }
    }

    // Merge booking details into ledger entries
    const enrichedLedger = ledger.map((row) => {
      const base = {
        id: row.id,
        type: row.type,
        amount: row.amount,
        balance_after: row.balance_after,
        created_at: row.created_at,
        reference_id: row.reference_id,
        note: row.note,
      }

      // Attach booking details if reference_id points to a booking
      if (row.reference_id && bookingsMap[row.reference_id]) {
        const booking = bookingsMap[row.reference_id]
        return {
          ...base,
          booking: {
            id: booking.id,
            booking_reference: booking.booking_reference,
            human_code: booking.human_code,
            date: booking.date,
            start_time: booking.start_time,
            table_number: booking.table_number,
          },
        }
      }

      return base
    })

    return NextResponse.json({
      balance,
      ledger: enrichedLedger,
    })
  } catch (err) {
    console.error('[wallet/ledger] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
