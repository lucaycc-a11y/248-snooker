import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceSupabase } from '@/lib/supabase/service'
import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'
import { rateLimit } from '@/lib/rate-limit'
import { PaymentXClient } from '@/lib/paymentx/client'
import { settlePaymentXOrder, type PaymentXOrderRow } from '@/lib/paymentx/settle'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/paymentx/status?bookingId=…
// Polled by the PaymentX return page. Asks KPay about the managed order (through
// settlePaymentXOrder, which also confirms the booking when KPay says paid).
//   state: confirmed | pending | needs_review | closed | unknown | none
export async function GET(req: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    if (!(await rateLimit('paymentx_status', `user:${user.id}`, 90, 60))) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const bookingId = new URL(req.url).searchParams.get('bookingId')
    if (!bookingId || !/^[0-9a-f-]{36}$/i.test(bookingId)) {
      return NextResponse.json({ error: 'Missing bookingId' }, { status: 400 })
    }

    const service = getServiceSupabase()
    const { data: booking } = await service
      .from('bookings')
      .select('id, status, human_code')
      .eq('id', bookingId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })

    const reference = { code: booking.human_code as string | null }

    if (booking.status === 'confirmed') return NextResponse.json({ state: 'confirmed', bookingId, reference })
    if (booking.status === 'payment_review') return NextResponse.json({ state: 'needs_review', bookingId, reference })

    const db = getLegacyServiceSupabase()
    const { data: rows } = await db
      .from('paymentx_orders')
      .select('id, booking_id, order_group_id, user_id, managed_out_trade_no, managed_order_no, amount, status, paid_order_no, is_test')
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: false })
      .limit(1)
    const order = ((rows ?? [])[0] as PaymentXOrderRow | undefined) ?? undefined
    if (!order) return NextResponse.json({ state: 'none', bookingId, reference })

    const hostname = new URL(req.url).hostname
    const outcome = await settlePaymentXOrder(order, 'status_poll', hostname)

    switch (outcome) {
      case 'confirmed':
      case 'already_confirmed':
        return NextResponse.json({ state: 'confirmed', bookingId, reference })
      case 'needs_review':
        return NextResponse.json({ state: 'needs_review', bookingId, reference })
      case 'pending': {
        const cashierUrl =
          order.status === 'pending' && order.managed_order_no
            ? new PaymentXClient(hostname).buildCashierUrl(
                order.managed_order_no,
                new URL(req.url).searchParams.get('mode') === 'h5' ? 'h5' : 'web',
              )
            : null
        return NextResponse.json({ state: 'pending', bookingId, reference, cashierUrl })
      }
      case 'closed':
        return NextResponse.json({ state: 'closed', bookingId, reference })
      default:
        return NextResponse.json({ state: 'unknown', bookingId, reference })
    }
  } catch (e) {
    console.error('[paymentx/status] error', (e as Error).message)
    return NextResponse.json({ state: 'unknown' }, { status: 200 })
  }
}
