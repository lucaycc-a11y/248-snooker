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

    const { data, error } = await getServiceSupabase().rpc('retry_payment_failed_booking', {
      p_booking_id: bookingId,
      p_user_id: user.id,
    })
    if (error) {
      console.error('[checkout/retry] rpc_error', { message: error.message, userId: user.id, bookingId })
      return NextResponse.json({ error: 'Unable to retry payment' }, { status: 500 })
    }

    const result = rpcResult(data)
    if (!result.success) {
      const status = result.reason === 'booking_not_found' ? 404 : result.reason === 'hold_expired' ? 409 : 400
      return NextResponse.json({ error: result.reason ?? 'Booking is not retryable' }, { status })
    }

    return NextResponse.json({
      success: true,
      bookingId: result.bookingId ?? bookingId,
      orderGroupId: result.orderGroupId,
    })
  } catch (error) {
    console.error('[checkout/retry] error', { message: (error as Error).message })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
