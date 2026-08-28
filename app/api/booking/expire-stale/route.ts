import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/service'

export const runtime = 'nodejs'

/**
 * POST /api/booking/expire-stale
 *
 * Protected scheduler endpoint. The database RPC remains service-role-only;
 * this route adds a separate shared-secret gate before invoking it.
 */
export async function POST(req: Request) {
  const expected = process.env.BOOKING_EXPIRY_CRON_SECRET
  const supplied = req.headers.get('x-booking-expiry-secret')
  if (!expected || !supplied || supplied !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { data, error } = await getServiceSupabase().rpc('expire_stale_bookings')
    if (error) {
      console.error('[booking/expire-stale] rpc_error', { message: error.message })
      return NextResponse.json({ error: 'Unable to expire stale bookings' }, { status: 500 })
    }
    return NextResponse.json({ success: true, result: data })
  } catch (error) {
    console.error('[booking/expire-stale] error', { message: (error as Error).message })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
