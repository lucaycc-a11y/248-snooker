import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceSupabase } from '@/lib/supabase/service'
import { rateLimit } from '@/lib/rate-limit'
import { withSecurity } from '@/lib/security/api-wrapper'
import { getLiveKPayState } from '@/lib/payments/live-order'
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
    if (row && (row.status === 'pending' || row.status === 'payment_failed')) {
      const live = await getLiveKPayState(row.provider_order_no, new URL(req.url).hostname)
      if (live === 'paid' || live === 'pending' || live === 'unknown') {
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

    await logPaymentEvent({
      bookingId,
      orderGroupId: row?.order_group_id ?? null,
      providerOrderNo: row?.provider_order_no ?? null,
      event: 'cancelled_by_user',
      source: 'user',
      fromState: row?.status ?? null,
      toState: 'cancelled',
      reason: 'kpay_closed_or_no_order',
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
