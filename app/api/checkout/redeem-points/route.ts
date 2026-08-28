import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceSupabase } from '@/lib/supabase/service'
import { rateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'

// GET /api/checkout/redeem-points
// Returns the authenticated user's current points balance and the list of
// active redemption rules.
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const service = getServiceSupabase()

    const [pointsRes, rulesRes, holdsRes] = await Promise.all([
      service
        .from('users')
        .select('points')
        .eq('id', user.id)
        .single(),
      service
        .from('points_redemption_rules')
        .select('id, points_required, discount_amount, display_order')
        .eq('is_active', true)
        .order('display_order'),
      service
        .from('points_holds')
        .select('points_amount')
        .eq('user_id', user.id)
        .eq('status', 'held'),
    ])

    const balance = Number(pointsRes.data?.points ?? 0)
    const heldTotal = (holdsRes.data ?? []).reduce(
      (sum, h) => sum + (h.points_amount as number),
      0,
    )

    return NextResponse.json({
      balance,
      available: balance - heldTotal,
      rules: rulesRes.data ?? [],
    })
  } catch (err) {
    console.error('[redeem-points] GET error', { message: (err as Error).message })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// POST /api/checkout/redeem-points
// { bookingId: string, ruleId: string | null }
// ruleId = null  → release any existing hold on this booking.
// ruleId = <id>  → apply the selected rule (validate, hold, update booking).
// Idempotent: reapplying the same rule on the same booking replaces the hold.
export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const allowed = await rateLimit('redeem_points', `user:${user.id}`, 20, 60)
    if (!allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

    const body = await req.json().catch(() => null)
    const bookingId: unknown = body?.bookingId
    const ruleId: unknown = body?.ruleId

    if (typeof bookingId !== 'string' || !bookingId) {
      return NextResponse.json({ error: 'Missing bookingId' }, { status: 400 })
    }
    if (ruleId !== null && typeof ruleId !== 'string') {
      return NextResponse.json({ error: 'Invalid ruleId' }, { status: 400 })
    }

    const service = getServiceSupabase()

    // Verify booking ownership and pending status.
    const { data: booking, error: bookingErr } = await service
      .from('bookings')
      .select('id, user_id, status, total_price')
      .eq('id', bookingId)
      .eq('user_id', user.id)
      .single()

    if (bookingErr || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }
    if (booking.status !== 'pending') {
      return NextResponse.json({ error: 'Booking is not pending' }, { status: 409 })
    }

    // Release path: remove any existing hold and reset booking discount.
    if (ruleId === null) {
      await releaseHold(service, bookingId, user.id)
      await service
        .from('bookings')
        .update({ points_redeemed: 0, points_discount: 0 })
        .eq('id', bookingId)
        .eq('user_id', user.id)
      return NextResponse.json({ applied: false, discount: 0, finalTotal: booking.total_price })
    }

    // Apply path: validate rule, check available points, upsert hold.
    const { data: rule, error: ruleErr } = await service
      .from('points_redemption_rules')
      .select('id, points_required, discount_amount, is_active')
      .eq('id', ruleId)
      .single()

    if (ruleErr || !rule || !rule.is_active) {
      return NextResponse.json({ error: 'Redemption rule not found or inactive' }, { status: 404 })
    }

    const pointsRequired = rule.points_required as number
    const discountAmount = Number(rule.discount_amount)

    // Fetch current balance and sum of all OTHER holds (not this booking).
    const [userRes, otherHoldsRes] = await Promise.all([
      service.from('users').select('points').eq('id', user.id).single(),
      service
        .from('points_holds')
        .select('points_amount')
        .eq('user_id', user.id)
        .eq('status', 'held')
        .neq('booking_id', bookingId),
    ])

    const balance = Number(userRes.data?.points ?? 0)
    const otherHeld = (otherHoldsRes.data ?? []).reduce(
      (sum, h) => sum + (h.points_amount as number),
      0,
    )
    const available = balance - otherHeld

    if (available < pointsRequired) {
      return NextResponse.json(
        { error: 'Insufficient points', available, required: pointsRequired },
        { status: 409 },
      )
    }

    // Release any existing hold on this booking before creating a new one.
    await releaseHold(service, bookingId, user.id)

    // Insert the new hold.
    const { error: holdErr } = await service.from('points_holds').insert({
      user_id: user.id,
      booking_id: bookingId,
      points_amount: pointsRequired,
      rule_id: ruleId,
      status: 'held',
    })
    if (holdErr) {
      console.error('[redeem-points] hold insert failed', { message: holdErr.message })
      return NextResponse.json({ error: 'Could not apply points hold' }, { status: 500 })
    }

    // Update booking with the selected discount (server-calculated, never trust browser).
    const finalTotal = Math.max(0, booking.total_price - discountAmount)
    await service
      .from('bookings')
      .update({ points_redeemed: pointsRequired, points_discount: discountAmount })
      .eq('id', bookingId)
      .eq('user_id', user.id)

    return NextResponse.json({
      applied: true,
      discount: discountAmount,
      pointsRedeemed: pointsRequired,
      finalTotal,
    })
  } catch (err) {
    console.error('[redeem-points] POST error', { message: (err as Error).message })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

async function releaseHold(
  service: ReturnType<typeof getServiceSupabase>,
  bookingId: string,
  userId: string,
) {
  await service
    .from('points_holds')
    .update({ status: 'released' })
    .eq('booking_id', bookingId)
    .eq('user_id', userId)
    .eq('status', 'held')
}
