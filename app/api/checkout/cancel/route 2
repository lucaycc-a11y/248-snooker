import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceSupabase } from '@/lib/supabase/service'
import { rateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export async function POST(req: Request) {
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

    const { data, error } = await getServiceSupabase().rpc('cancel_pending_booking', {
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

    return NextResponse.json({ success: true, bookingId })
  } catch (error) {
    console.error('[checkout/cancel] error', { message: (error as Error).message })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
