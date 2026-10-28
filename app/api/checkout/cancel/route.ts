import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceSupabase } from '@/lib/supabase/service'
import { rateLimit } from '@/lib/rate-limit'
import { withSecurity } from '@/lib/security/api-wrapper'
import { getLiveKPayState } from '@/lib/payments/live-order'
import { isPaymentFreezeActive } from '@/lib/payments/freeze-flag'
import { logPaymentEvent } from '@/lib/payments/payment-events'

export const runtime = 'nodejs'

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

async function handleCancel(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const allowed = await rateLimit('checkout_cancel', `user:${user.id}`, 10, 60)
    if (!allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

    const body: unknown = await req.json().catch(() => null)
    const bookingId = body && typeof body === 'object' && !Array.isArray(body)
      ? (body as Record<string, unknown>).bookingId
      : null
    if (!isUuid(bookingId)) return NextResponse.json({ error: 'Invalid bookingId' }, { status: 400 })
    // Set by the payment screen when the booking it adopted carries an outdated price: the
    // customer is abandoning that checkout on purpose, so a still-open (unpaid) KPay order
    // does not block the release. A PAID order is still refused. If the abandoned order is
    // paid later, the webhook confirms it or parks it for review (never lost, never refunded).
    const priceChangedRelease = (body as Record<string, unknown>).reason === 'price_changed'

    const service = getServiceSupabase()

    // A KPay order that still exists is the source of truth. Releasing the booking,
    // slot and credit/promo holds while the order can still be paid is how a customer
    // ends up charged for a cancelled booking, so ask KPay first:
    //   paid / pending / unknown -> refuse (the status API confirms a paid order)
    //   closed / no order        -> safe to release
    const { data: row } = await service
      .from('bookings')
      .select('id, status, provider_order_no, order_group_id')
      .eq('id', bookingId)
      .eq('user_id', user.id)
      .maybeSingle()
    const freeze = await isPaymentFreezeActive(user.id)
    let released: 'closed_or_none' | 'released_open_order' | 'unchecked' = 'unchecked'
    if (freeze && row && (row.status === 'pending' || row.status === 'payment_failed')) {
      const live = await getLiveKPayState(row.provider_order_no, new URL(req.url).hostname)
      // Only a PAID order blocks a customer-initiated cancel. An unpaid open order is released
      // at once (the customer wants to book again); if it is paid later it is auto-confirmed.
      const blocks = live === 'paid'
      if (blocks) {
        await logPaymentEvent({
          bookingId,
          orderGroupId: row.order_group_id,
          providerOrderNo: row.provider_order_no,
          event: 'cancel_refused',
          source: 'user',
          fromState: row.status,
          reason: `kpay_${live}`,
        })
        return NextResponse.json(
          { error: live === 'paid' ? 'payment_received' : 'payment_in_progress' },
          { status: 409 },
        )
      }
      released = 'closed_or_none'
      if (live === 'pending' || live === 'unknown') released = 'released_open_order'
    }

    const { data, error } = await service.rpc('cancel_pending_booking', {
      p_booking_id: bookingId,
      p_user_id: user.id,
    })
    if (error) {
      console.error('[checkout/cancel] rpc_error', { message: error.message, userId: user.id, bookingId })
      return NextResponse.json({ error: 'Unable to cancel booking' }, { status: 500 })
    }

    if (!data || typeof data !== 'object' || Array.isArray(data) || (data as Record<string, unknown>).success !== true) {
      const reason = data && typeof data === 'object' && !Array.isArray(data) && typeof (data as Record<string, unknown>).reason === 'string'
        ? (data as Record<string, unknown>).reason as string
        : 'booking_not_cancellable'
      const status = reason === 'booking_not_found' ? 404 : 409
      return NextResponse.json({ error: reason }, { status })
    }

    if (released === 'closed_or_none' || released === 'released_open_order') {
      // KPay confirmed the order is closed (or never existed): close out the attempt too so it
      // does not sit as "pending" in the payment log.
      await service
        .from('payment_attempts')
        .update({ status: 'cancelled', failure_code: 'cancelled_by_user', updated_at: new Date().toISOString() })
        .eq('booking_id', bookingId)
        .in('status', ['claimed', 'pending'])
    }

    await logPaymentEvent({
      bookingId,
      orderGroupId: row?.order_group_id ?? null,
      providerOrderNo: row?.provider_order_no ?? null,
      event: 'cancelled_by_user',
      source: 'user',
      fromState: row?.status ?? null,
      toState: 'cancelled',
      reason:
        released === 'closed_or_none'
          ? 'kpay_closed_or_no_order'
          : released === 'released_open_order'
            ? (priceChangedRelease ? 'price_changed_open_order_released' : 'customer_released_open_order')
            : 'kpay_not_checked',
    })
    return NextResponse.json({ success: true, bookingId })
  } catch (error) {
    console.error('[checkout/cancel] error', { message: (error as Error).message })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// Export with security wrapper: CSRF + rate limiting
export const POST = withSecurity(handleCancel, {
  csrf: true,
  rateLimit: {
    bucket: 'checkout_cancel',
    max: 10,
    windowSeconds: 60,
    identifierType: 'both',
  },
})
