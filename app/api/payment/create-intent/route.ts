import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceSupabase } from '@/lib/supabase/service'
import { getStripe } from '@/lib/stripe/server'
import { calculatePrice } from '@/lib/pricing'
import {
  loadPeriods,
  resolveTierForUser,
  validateSlotLock,
  slotBounds,
  periodForStart,
} from '@/lib/booking/server'
import { rateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'

// POST /api/payment/create-intent  { slotId }
// Validates the slot lock, RE-DERIVES the price server-side, ensures a pending
// bookings row exists, and creates a Stripe PaymentIntent (Payment Element).
// Idempotency key = booking_id so a double-tap reuses the same intent. The
// webhook later calls confirm_booking(booking_id, …).
export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const allowed = await rateLimit('payment_intent', `user:${user.id}`, 20, 60)
    if (!allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const body = await req.json().catch(() => null)
    const slotId = body?.slotId
    if (typeof slotId !== 'string' || !slotId) {
      return NextResponse.json({ error: 'Missing slotId' }, { status: 400 })
    }

    const slot = await validateSlotLock(slotId, user.id)
    if (!slot) {
      return NextResponse.json(
        { error: 'Slot lock invalid or expired' },
        { status: 409 },
      )
    }

    // Re-derive the price from the LOCKED slot — never trust a client amount.
    const startHour = parseInt(slot.start_time.slice(0, 2), 10)
    const { slotStart, slotEnd } = slotBounds(slot.date, startHour, slot.duration_hours)
    const periods = await loadPeriods()
    const tier = await resolveTierForUser(user.id)
    const quote = calculatePrice(slotStart, slotEnd, tier, periods)
    const period = periodForStart(
      startHour,
      slotStart.getDay() === 0 || slotStart.getDay() === 6,
      periods,
    )

    // Find-or-create the pending booking for this slot+user (idempotent so a retry
    // doesn't create duplicate pending rows).
    const service = getServiceSupabase()
    const { data: existing } = await service
      .from('bookings')
      .select('id')
      .eq('slot_id', slot.id)
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .maybeSingle()

    let bookingId = existing?.id as string | undefined
    if (!bookingId) {
      const { data: inserted, error: insErr } = await service
        .from('bookings')
        .insert({
          user_id: user.id,
          slot_id: slot.id,
          date: slot.date,
          start_time: slot.start_time,
          end_time: slot.end_time,
          duration_hours: slot.duration_hours,
          period,
          total_price: quote.total,
          status: 'pending',
          table_number: slot.table_number,
          is_free_booking: quote.total === 0,
          // payment_method intentionally left unset here — confirm_booking sets it
          // from the actual Stripe method. ASSUMED nullable; if NOT NULL, add a
          // DB default of 'card' or set a placeholder here.
        })
        .select('id')
        .single()
      if (insErr || !inserted) {
        console.error('pending_booking_insert_error', insErr?.message)
        return NextResponse.json({ error: 'Could not create booking' }, { status: 500 })
      }
      bookingId = inserted.id
    }
    if (!bookingId) {
      return NextResponse.json({ error: 'Could not resolve booking' }, { status: 500 })
    }

    const stripe = getStripe()
    const intent = await stripe.paymentIntents.create(
      {
        amount: quote.amountInCents,
        currency: 'hkd',
        automatic_payment_methods: { enabled: true },
        metadata: {
          booking_id: bookingId,
          slot_id: slot.id,
          user_id: user.id,
        },
      },
      { idempotencyKey: bookingId },
    )

    return NextResponse.json({
      clientSecret: intent.client_secret,
      bookingId,
      amount: quote.amountInCents,
      currency: quote.currency,
    })
  } catch (err) {
    console.error('create_intent_error', (err as Error).message)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
