// GET /api/uat/test-bookings — recent is_test = true bookings with pay status
//
// Feeds the dev2 "Refund Test Booking" list. Test bookings charge REAL money
// (UAT shares the production KPay merchant account), so an operator needs to see
// what was actually charged and what is refundable.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceSupabase } from '@/lib/supabase/service'
import { requireActiveAdmin } from '@/lib/uat/admin-auth'

export const runtime = 'nodejs'

type BookingRow = {
  id: string
  human_code: string | null
  date: string
  start_time: string
  end_time: string
  table_number: number | null
  duration_hours: number | null
  total_price: number | null
  status: string
  payment_method: string | null
  provider_order_no: string | null
  refunded_at: string | null
  refund_amount: number | null
  created_at: string
  user_id: string
}

export async function GET(req: Request) {
  try {
    const supabase = await createClient()
    const auth = await requireActiveAdmin(supabase)
    if (!auth.isAdmin) {
      return NextResponse.json({ error: auth.error }, { status: 403 })
    }

    // ?scope=mine limits the list to the calling admin's own test bookings.
    const scope = new URL(req.url).searchParams.get('scope')
    const service = getServiceSupabase()

    let query = service
      .from('bookings')
      .select(
        'id, human_code, date, start_time, end_time, table_number, duration_hours, total_price, status, payment_method, provider_order_no, refunded_at, refund_amount, created_at, user_id',
      )
      .eq('is_test', true)
      .order('created_at', { ascending: false })
      .limit(25)

    if (scope === 'mine') query = query.eq('user_id', auth.user.id)

    const { data, error } = await query
    if (error) {
      console.error('[uat/test-bookings] query failed', { message: error.message })
      return NextResponse.json({ error: 'Could not load test bookings' }, { status: 500 })
    }

    const rows = (data ?? []) as BookingRow[]

    // Latest attempt per booking, so the panel shows what KPay actually did
    // rather than only the booking row's own status.
    const ids = rows.map((r) => r.id)
    const attemptByBooking = new Map<string, { id: string; status: string; providerOrderNo: string | null }>()
    if (ids.length) {
      const { data: attempts } = await service
        .from('payment_attempts')
        .select('id, booking_id, status, provider_order_no, created_at')
        .in('booking_id', ids)
        .order('created_at', { ascending: false })
      for (const a of (attempts ?? []) as Array<{
        id: string
        booking_id: string
        status: string
        provider_order_no: string | null
      }>) {
        if (!attemptByBooking.has(a.booking_id)) {
          attemptByBooking.set(a.booking_id, {
            id: a.id,
            status: a.status,
            providerOrderNo: a.provider_order_no,
          })
        }
      }
    }

    const bookings = rows.map((r) => {
      const attempt = attemptByBooking.get(r.id) ?? null
      const providerOrderNo = r.provider_order_no ?? attempt?.providerOrderNo ?? null
      return {
        id: r.id,
        humanCode: r.human_code,
        date: r.date,
        startTime: r.start_time,
        endTime: r.end_time,
        tableNumber: r.table_number,
        durationHours: r.duration_hours,
        totalPrice: r.total_price,
        status: r.status,
        paymentMethod: r.payment_method,
        providerOrderNo,
        refundedAt: r.refunded_at,
        refundAmount: r.refund_amount,
        createdAt: r.created_at,
        isOwn: r.user_id === auth.user.id,
        attemptId: attempt?.id ?? null,
        attemptStatus: attempt?.status ?? null,
        // Refundable = money actually moved, nothing refunded yet, and we hold
        // the KPay order reference the refund API needs.
        refundable:
          !r.refunded_at &&
          providerOrderNo !== null &&
          (r.status === 'confirmed' || attempt?.status === 'succeeded') &&
          (r.total_price ?? 0) > 0,
      }
    })

    return NextResponse.json({ bookings })
  } catch (error) {
    console.error('[uat/test-bookings] error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
