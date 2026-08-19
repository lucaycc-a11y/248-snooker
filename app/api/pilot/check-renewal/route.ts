import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/service'
import { resolvePilotSession } from '@/lib/pilot/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/pilot/check-renewal  { booking_id }
// Requires Authorization: Bearer {session_token}
export async function POST(request: Request) {
  const session = await resolvePilotSession(request.headers.get('authorization'))
  if (!session) return NextResponse.json({ error: 'invalid_session' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const bookingId = typeof body?.booking_id === 'string' ? body.booking_id : ''
  if (!bookingId) return NextResponse.json({ error: 'missing booking_id' }, { status: 400 })

  const service = getServiceSupabase()

  const { data: rpc, error: rpcErr } = await service.rpc('check_renewal_availability', {
    p_booking_id: bookingId,
  })
  if (rpcErr) {
    if (rpcErr.message?.includes('BOOKING_NOT_FOUND')) {
      return NextResponse.json({ error: 'booking_not_found' }, { status: 404 })
    }
    console.error('[pilot/check-renewal] rpc failed', rpcErr)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }

  const result = rpc as { available: boolean; amount: number; period: string; next_booking_start: string | null }

  // Fetch enabled payment methods.
  const { data: methods } = await service
    .from('payment_settings')
    .select('method')
    .eq('enabled', true)
  const enabledPaymentMethods = (methods ?? []).map((r: { method: string }) => r.method)

  if (!result.available) {
    return NextResponse.json({
      available: false,
      next_booking_start: result.next_booking_start,
    })
  }

  return NextResponse.json({
    available: true,
    amount: result.amount,
    period: result.period,
    next_booking_start: result.next_booking_start,
    enabled_payment_methods: enabledPaymentMethods,
  })
}
