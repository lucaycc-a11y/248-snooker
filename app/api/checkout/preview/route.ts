import { NextResponse, NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prepareCheckout, prepareFailureStatus } from '@/lib/checkout/prepare'
import { getServiceSupabase } from '@/lib/supabase/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/checkout/preview
// Returns estimated totals: subtotal, promoDiscount, walletApplied, earnPoints, total
// Body:
//   - bookingId: string
//   - promoCode?: string
//   - useWallet?: boolean
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => null)
    if (!body?.bookingId) {
      return NextResponse.json({ error: 'Missing bookingId' }, { status: 400 })
    }

    const bookingId = body.bookingId as string
    const promoCode = typeof body.promoCode === 'string' ? body.promoCode : null
    const useWallet = body.useWallet === true

    const service = getServiceSupabase()

    // Fetch booking to get subtotal
    const { data: booking, error: bookingErr } = await service
      .from('bookings')
      .select('id, user_id, base_price, status')
      .eq('id', bookingId)
      .eq('user_id', user.id)
      .single()

    if (bookingErr || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    if (booking.status !== 'pending') {
      return NextResponse.json({ error: 'Booking is not pending' }, { status: 409 })
    }

    const subtotal = booking.base_price ?? 0

    // Call prepare_checkout to get discount and totals
    const outcome = await prepareCheckout(service, {
      bookingId,
      userId: user.id,
      promoCode,
      walletAmount: useWallet ? subtotal : 0,
    })

    if (!outcome.ok) {
      const { reason } = outcome.failure
      return NextResponse.json(
        { error: reason },
        { status: prepareFailureStatus(reason) }
      )
    }

    const { prepared } = outcome
    const earnPoints = Math.floor(prepared.total / 10) // Estimate: HK$10 = 1 point

    return NextResponse.json({
      subtotal,
      promoDiscount: prepared.discountAmount,
      walletApplied: prepared.kind === 'credits' ? prepared.total - (subtotal - prepared.discountAmount) : 0,
      earnPoints,
      total: prepared.total,
    })
  } catch (err) {
    const e = err as Error
    console.error('[checkout/preview] error', { message: e.message, stack: e.stack })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
