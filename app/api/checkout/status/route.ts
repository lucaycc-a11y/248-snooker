import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceSupabase } from '@/lib/supabase/service'
import { getProviderForMethod } from '@/lib/payments'

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

    // If the booking is already confirmed server-side (webhook fired), short-circuit
    if (booking.status === 'confirmed') {
      return NextResponse.json({
        bookingId: booking.id,
        status: 'confirmed',
        providerStatus: 'success',
      })
    }

    if (booking.status === 'cancelled') {
      return NextResponse.json({
        bookingId: booking.id,
        status: 'cancelled',
        providerStatus: 'cancelled',
      })
    }

    // No provider order yet — the order hasn't been created
    if (!booking.provider_order_no || booking.payment_provider !== 'kpay') {
      return NextResponse.json({
        bookingId: booking.id,
        status: booking.status,
        providerStatus: 'pending',
      })
    }

    // Query the payment provider for current order status.
    // Use the booking's stored method so the query signs with the right
    // merchant context; the provider is KPay here (checked above).
    const method = (booking.payment_method === 'fps' || booking.payment_method === 'payme' || booking.payment_method === 'octopus')
      ? booking.payment_method
      : 'fps'
    const provider = await getProviderForMethod(method, {})
    const orderStatus = await provider.queryOrder(booking.provider_order_no)

    // Map KPay order status to a UI-friendly status
    let uiStatus: string
    switch (orderStatus.status) {
      case 'success':
        uiStatus = 'confirmed' // will be confirmed by webhook imminently
        break
      case 'failed':
      case 'cancelled':
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
      rawStatus: orderStatus.rawStatus,
    })
  } catch (err) {
    const e = err as Error
    console.error('[checkout/status] error', { message: e.message, stack: e.stack })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}