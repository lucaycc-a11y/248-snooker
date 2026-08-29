import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceSupabase } from '@/lib/supabase/service'
import { getPaymentProvider } from '@/lib/payments'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/checkout/status?bookingId=...
// Returns the KPay order status for a booking. Used by the UI to poll while
// waiting for the customer to complete payment (QR scan / H5 redirect).
//
// For grouped bookings, the primary bookingId is sufficient — all siblings
// share the same provider_order_no.
export async function GET(req: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const bookingId = new URL(req.url).searchParams.get('bookingId')
    if (!bookingId) {
      return NextResponse.json({ error: 'Missing bookingId' }, { status: 400 })
    }

    const service = getServiceSupabase()

    const { data: booking, error: bookingErr } = await service
      .from('bookings')
      .select('id, status, payment_provider, provider_order_no, payment_method')
      .eq('id', bookingId)
      .eq('user_id', user.id)
      .single()

    if (bookingErr || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    // Slot-hold state drives the recovery screen: it decides whether "retry
    // payment" is still possible (hold alive) or the user must pick new slots
    // (hold gone), and supplies the countdown deadline. Only meaningful while
    // the booking is unresolved, so it's skipped on terminal states below.
    const holdState = async (): Promise<{ holdActive: boolean; holdExpiresAt: string | null }> => {
      const { data, error } = await service.rpc('checkout_hold_expiry', {
        p_booking_id: booking.id,
        p_user_id: user.id,
      })
      if (error || !data || typeof data !== 'object' || Array.isArray(data)) {
        // Unknown hold state must not imply an active hold — retry would then
        // re-create an order against slots someone else may already hold.
        if (error) console.error('[checkout/status] hold_expiry failed', { message: error.message })
        return { holdActive: false, holdExpiresAt: null }
      }
      const record = data as Record<string, unknown>
      return {
        holdActive: record.hold_active === true,
        holdExpiresAt: typeof record.expires_at === 'string' ? record.expires_at : null,
      }
    }

    // If the booking is already confirmed server-side (webhook fired), short-circuit
    if (booking.status === 'confirmed') {
      return NextResponse.json({
        bookingId: booking.id,
        status: 'confirmed',
        providerStatus: 'success',
      })
    }

    if (booking.status === 'cancelled' || booking.status === 'expired') {
      return NextResponse.json({
        bookingId: booking.id,
        status: booking.status,
        providerStatus: booking.status === 'cancelled' ? 'cancelled' : booking.status,
        holdActive: false,
        holdExpiresAt: null,
      })
    }

    // payment_failed is recoverable, so it reports hold state — the UI needs it
    // to decide between "retry payment" and "back to slot selection".
    if (booking.status === 'payment_failed') {
      const hold = await holdState()
      return NextResponse.json({
        bookingId: booking.id,
        status: booking.status,
        providerStatus: booking.status,
        holdActive: hold.holdActive,
        holdExpiresAt: hold.holdExpiresAt,
      })
    }

    const hold = await holdState()

    // No provider order yet — the order hasn't been created
    if (!booking.provider_order_no || booking.payment_provider !== 'kpay') {
      return NextResponse.json({
        bookingId: booking.id,
        status: booking.status === 'pending' ? 'pending' : 'failed',
        providerStatus: 'pending',
        holdActive: hold.holdActive,
        holdExpiresAt: hold.holdExpiresAt,
      })
    }

    // Query the payment provider for current order status.
    // Use the booking's stored method so the query signs with the right
    // merchant context; the provider is KPay here (checked above).
    const provider = getPaymentProvider()
    const orderStatus = await provider.queryOrder(booking.provider_order_no)

    // Provider success is not database confirmation. The webhook still needs to
    // commit the booking transition and generate the booking credentials.
    let uiStatus: string
    switch (orderStatus.status) {
      case 'success':
        uiStatus = 'pending_confirmation'
        break
      case 'failed':
        uiStatus = 'failed'
        break
      case 'cancelled':
        uiStatus = 'cancelled'
        break
      case 'closed':
        uiStatus = 'failed'
        break
      case 'refunded':
        uiStatus = 'refunded'
        break
      default:
        uiStatus = 'pending'
    }

    return NextResponse.json({
      bookingId: booking.id,
      status: uiStatus,
      providerStatus: orderStatus.status,
      holdActive: hold.holdActive,
      holdExpiresAt: hold.holdExpiresAt,
      rawStatus: orderStatus.rawStatus,
      ...(orderStatus.failureCode ? { failureCode: orderStatus.failureCode } : {}),
      ...(orderStatus.failureReason ? { failureReason: orderStatus.failureReason } : {}),
    })
  } catch (err) {
    const e = err as Error
    console.error('[checkout/status] error', { message: e.message, stack: e.stack })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}