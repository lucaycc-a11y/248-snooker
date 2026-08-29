import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceSupabase } from '@/lib/supabase/service'
import { rateLimit } from '@/lib/rate-limit'
import { logSiteError } from '@/lib/errors/log'
import {
  parsePointsRules,
  prepareCheckout,
  prepareFailureStatus,
} from '@/lib/checkout/prepare'

export const runtime = 'nodejs'

// GET /api/checkout/redeem-points
// Returns the member's balance, the amount still spendable after existing holds,
// and the active redemption rules from config. The balance shown to the customer
// must exclude points already held by another pending checkout, otherwise they
// can select a rule that prepare_checkout will then reject.
export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const service = getServiceSupabase()

    const [{ data: userRow, error: userErr }, { data: holds, error: holdsErr }, { data: configRow }] =
      await Promise.all([
        service.from('users').select('points').eq('id', user.id).maybeSingle(),
        service.from('points_holds').select('points').eq('user_id', user.id).eq('status', 'held'),
        service.from('config').select('value').eq('key', 'points_redemption').maybeSingle(),
      ])

    if (userErr) throw new Error(`points balance lookup failed: ${userErr.message}`)
    if (holdsErr) throw new Error(`points holds lookup failed: ${holdsErr.message}`)

    const balance = typeof userRow?.points === 'number' ? userRow.points : 0
    const heldPoints = (holds ?? []).reduce(
      (sum, row) => sum + (typeof row.points === 'number' ? row.points : 0),
      0,
    )

    return NextResponse.json({
      balance,
      available: Math.max(0, balance - heldPoints),
      rules: parsePointsRules(configRow?.value),
    })
  } catch (err) {
    const e = err as Error
    console.error('[checkout/redeem-points] GET error', { message: e.message })
    await logSiteError('checkout/redeem-points', 'error', 'balance lookup failed', {
      message: e.message,
    })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// POST /api/checkout/redeem-points  { bookingId, pointsAmount }
//
// Holds (or clears) a points reservation against a pending booking and returns
// the server-recalculated total. pointsAmount of 0 clears the selection.
//
// This does not charge anything: prepare_checkout only reserves. The points are
// deducted by consume_checkout_discount inside confirm_booking, and released by
// release_checkout_holds on failure, cancellation, expiry, retry, or slot release.
export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const allowed = await rateLimit('redeem_points', `user:${user.id}`, 30, 60)
    if (!allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const body = await req.json().catch(() => null)
    const bookingId = typeof body?.bookingId === 'string' ? body.bookingId : null
    const rawPoints = body?.pointsAmount
    const pointsAmount = typeof rawPoints === 'number' ? rawPoints : Number(rawPoints)

    if (!bookingId) {
      return NextResponse.json({ error: 'Missing bookingId' }, { status: 400 })
    }
    if (!Number.isInteger(pointsAmount) || pointsAmount < 0) {
      return NextResponse.json({ error: 'Invalid pointsAmount' }, { status: 400 })
    }

    const service = getServiceSupabase()

    // prepare_checkout validates ownership, pending status, rule existence, and
    // the balance net of other holds. Passing points: 0 clears any prior hold and
    // resets total_price to base_price.
    const outcome = await prepareCheckout(service, {
      bookingId,
      userId: user.id,
      points: pointsAmount,
    })

    if (!outcome.ok) {
      const { reason, availablePoints } = outcome.failure
      console.log('[checkout/redeem-points] rejected', { bookingId, pointsAmount, reason })
      return NextResponse.json(
        {
          error: reason,
          ...(availablePoints !== undefined ? { availablePoints } : {}),
        },
        { status: prepareFailureStatus(reason) },
      )
    }

    const { prepared } = outcome
    console.log('[checkout/redeem-points] applied', {
      bookingId,
      pointsAmount,
      discount: prepared.discountAmount,
      total: prepared.total,
    })

    return NextResponse.json({
      subtotal: prepared.subtotal,
      discountAmount: prepared.discountAmount,
      total: prepared.total,
      pointsRedeemed: prepared.points,
    })
  } catch (err) {
    const e = err as Error
    console.error('[checkout/redeem-points] POST error', { message: e.message })
    await logSiteError('checkout/redeem-points', 'error', 'redemption failed', {
      message: e.message,
    })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
