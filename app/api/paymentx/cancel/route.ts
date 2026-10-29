import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceSupabase } from '@/lib/supabase/service'
import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'
import { releaseStaleCheckout } from '@/lib/checkout/release-stale'
import { settlePaymentXOrder, type PaymentXOrderRow } from '@/lib/paymentx/settle'
import { withSecurity } from '@/lib/security/api-wrapper'

export const runtime = 'nodejs'

// POST /api/paymentx/cancel { bookingId }
// Releases the slot — but only after asking KPay. A paid order is never released
// (409 payment_received); a failed lookup never releases either.
async function handleCancel(req: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body: unknown = await req.json().catch(() => null)
    const bookingId = typeof body === 'object' && body !== null ? (body as { bookingId?: unknown }).bookingId : null
    if (typeof bookingId !== 'string' || !/^[0-9a-f-]{36}$/i.test(bookingId)) {
      return NextResponse.json({ error: 'Missing bookingId' }, { status: 400 })
    }

    const service = getServiceSupabase()
    const { data: booking } = await service
      .from('bookings')
      .select('id, status')
      .eq('id', bookingId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    if (booking.status === 'confirmed' || booking.status === 'payment_review') {
      return NextResponse.json({ error: 'payment_received' }, { status: 409 })
    }

    const db = getLegacyServiceSupabase()
    const { data: rows } = await db
      .from('paymentx_orders')
      .select('id, booking_id, order_group_id, user_id, managed_out_trade_no, managed_order_no, amount, status, paid_order_no, is_test')
      .eq('booking_id', bookingId)
      .in('status', ['creating', 'pending'])
      .limit(1)
    const order = ((rows ?? [])[0] as PaymentXOrderRow | undefined) ?? undefined

    if (order) {
      const outcome = await settlePaymentXOrder(order, 'status_poll', new URL(req.url).hostname)
      if (outcome === 'confirmed' || outcome === 'already_confirmed' || outcome === 'needs_review') {
        return NextResponse.json({ error: 'payment_received' }, { status: 409 })
      }
      if (outcome === 'unknown') {
        return NextResponse.json({ error: 'verify_failed' }, { status: 503 })
      }
    }

    const released = await releaseStaleCheckout(service, {
      userId: user.id,
      bookingId,
      hostname: new URL(req.url).hostname,
      reason: 'paymentx_user_cancel',
    })
    if (!released) return NextResponse.json({ error: 'cannot_release' }, { status: 409 })

    if (order) {
      await db
        .from('paymentx_orders')
        .update({ status: 'cancelled', failure_reason: 'cancelled_by_user', updated_at: new Date().toISOString() })
        .eq('id', order.id)
        .in('status', ['creating', 'pending'])
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[paymentx/cancel] error', (e as Error).message)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export const POST = withSecurity(handleCancel, {
  csrf: true,
  rateLimit: { bucket: 'paymentx_cancel', max: 20, windowSeconds: 60, identifierType: 'both' },
})
