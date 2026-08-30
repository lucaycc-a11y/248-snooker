import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceSupabase } from '@/lib/supabase/service'
import { rateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function rpcResult(value: unknown): { success: boolean; reason?: string; bookingId?: string; orderGroupId?: string | null } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { success: false, reason: 'invalid_rpc_response' }
  const result = value as Record<string, unknown>
  return {
    success: result.success === true,
    reason: typeof result.reason === 'string' ? result.reason : undefined,
    bookingId: typeof result.booking_id === 'string' ? result.booking_id : undefined,
    orderGroupId: typeof result.order_group_id === 'string' ? result.order_group_id : null,
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const allowed = await rateLimit('checkout_retry', `user:${user.id}`, 10, 60)
    if (!allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

    const body: unknown = await req.json().catch(() => null)
    const bookingId = body && typeof body === 'object' && !Array.isArray(body)
      ? (body as Record<string, unknown>).bookingId
      : null
    if (!isUuid(bookingId)) return NextResponse.json({ error: 'Invalid bookingId' }, { status: 400 })

    // Pre-check: if the booking is already confirmed, block a new KPay order.
    // The RPC would also reject this, but short-circuiting here saves a round-trip
    // and returns a clear 409 for the UI to show a dedicated message.
    const { data: existing, error: lookupErr } = await getServiceSupabase()
      .from('bookings')
      .select('id, status')
      .eq('id', bookingId)
      .eq('user_id', user.id)
      .single()

    if (lookupErr || !existing) {
      console.log('[KPay] retry pre-check: booking_not_found', { bookingId, userId: user.id })
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    if (existing.status === 'confirmed') {
      console.log('[KPay] retry pre-check: already_confirmed', { bookingId, userId: user.id, status: existing.status })
      return NextResponse.json({ error: 'booking_already_confirmed' }, { status: 409 })
    }

    console.log('[KPay] retry request', { bookingId, userId: user.id, currentStatus: existing.status })

    const { data, error } = await getServiceSupabase().rpc('retry_payment_failed_booking', {
      p_booking_id: bookingId,
      p_user_id: user.id,
    })
    if (error) {
      console.error('[KPay] retry rpc_error', { message: error.message, userId: user.id, bookingId })
      return NextResponse.json({ error: 'Unable to retry payment' }, { status: 500 })
    }

    const result = rpcResult(data)
    if (!result.success) {
      const status = result.reason === 'booking_not_found' ? 404 : result.reason === 'hold_expired' ? 409 : 400
      console.log('[KPay] retry rejected', { bookingId, reason: result.reason, httpStatus: status })
      return NextResponse.json({ error: result.reason ?? 'Booking is not retryable' }, { status })
    }

    console.log('[KPay] retry accepted', { bookingId, newBookingId: result.bookingId, orderGroupId: result.orderGroupId })

    return NextResponse.json({
      success: true,
      bookingId: result.bookingId ?? bookingId,
      orderGroupId: result.orderGroupId,
    })
  } catch (error) {
    console.error('[KPay] retry error', { message: (error as Error).message })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
