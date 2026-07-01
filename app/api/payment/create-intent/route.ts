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

    // Accept a single slotId (back-compat) or slotIds[] + orderGroupId (grouped,
    // non-contiguous). Normalise to an array + optional group id.
    const rawIds: unknown = Array.isArray(body?.slotIds) ? body.slotIds : body?.slotId
    const slotIds: string[] = Array.isArray(rawIds)
      ? rawIds.filter((x): x is string => typeof x === 'string' && !!x)
      : typeof rawIds === 'string' && rawIds
        ? [rawIds]
        : []
    const orderGroupId: string | null =
      slotIds.length > 1 && typeof body?.orderGroupId === 'string' ? body.orderGroupId : null

    if (slotIds.length === 0) {
      return NextResponse.json({ error: 'Missing slotId' }, { status: 400 })
    }
    if (slotIds.length > 1 && !orderGroupId) {
      return NextResponse.json({ error: 'Missing orderGroupId for grouped booking' }, { status: 400 })
    }

    console.log('[payment/create-intent] attempt', { userId: user.id, slotIds, orderGroupId })

    const periods = await loadPeriods()
    const tier = await resolveTierForUser(user.id)
    const service = getServiceSupabase()

    // Validate every lock + re-derive every price server-side, then insert one
    // pending booking per slot. All rows share orderGroupId (null for singles).
    const bookingIds: string[] = []
    let amountInCents = 0
    let primaryBookingId: string | undefined

    for (const sid of slotIds) {
      const slot = await validateSlotLock(sid, user.id)
      if (!slot) {
        console.log('[payment/create-intent] rejected', { userId: user.id, slotId: sid, reason: 'lock_invalid_or_expired' })
        return NextResponse.json({ error: 'Slot lock invalid or expired' }, { status: 409 })
      }

      const startHour = parseInt(slot.start_time.slice(0, 2), 10)
      const { slotStart, slotEnd } = slotBounds(slot.date, startHour, slot.duration_hours)
      const quote = calculatePrice(slotStart, slotEnd, tier, periods)

      // No self-serve free/zero-amount path: Stripe rejects 0-amount intents, and
      // a 0 here means a pricing misconfig (comps are admin-flagged, not self-serve).
      if (quote.amountInCents <= 0) {
        return NextResponse.json({ error: 'Zero-amount bookings are not supported' }, { status: 400 })
      }

      const period = periodForStart(
        startHour,
        slotStart.getDay() === 0 || slotStart.getDay() === 6,
        periods,
      )

      // Find-or-create the pending booking for this slot+user (idempotent so a
      // retry doesn't create duplicate pending rows).
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
            is_free_booking: false, // self-serve bookings are always paid; comps are admin-flagged
            order_group_id: orderGroupId,
          })
          .select('id')
          .single()
        if (insErr || !inserted) {
          console.error('[payment/create-intent] pending_booking_insert_error', {
            message: insErr?.message,
            code: insErr?.code,
            userId: user.id,
            slotId: slot.id,
          })
          return NextResponse.json({ error: 'Could not create booking' }, { status: 500 })
        }
        bookingId = inserted.id
      } else if (orderGroupId) {
        // Reused a pending row from an earlier attempt — ensure it carries the group id.
        await service.from('bookings').update({ order_group_id: orderGroupId }).eq('id', bookingId)
      }
      if (!bookingId) {
        return NextResponse.json({ error: 'Could not resolve booking' }, { status: 500 })
      }

      bookingIds.push(bookingId)
      amountInCents += quote.amountInCents
      if (!primaryBookingId) primaryBookingId = bookingId
    }

    if (!primaryBookingId) {
      return NextResponse.json({ error: 'Could not resolve booking' }, { status: 500 })
    }

    // Idempotency key: group id when grouped (so a double-tap reuses one intent
    // across all rows), else the single booking id.
    const idempotencyKey = orderGroupId ?? primaryBookingId

    let intent
    try {
      const stripe = getStripe() // throws if STRIPE_SECRET_KEY is unset
      intent = await stripe.paymentIntents.create(
        {
          amount: amountInCents,
          currency: 'hkd',
          automatic_payment_methods: { enabled: true },
          // Stripe emails the receipt itself on success — one less thing for the
          // frontend/webhook to send. user.email is the authoritative auth email,
          // never client input.
          receipt_email: user.email ?? undefined,
          metadata: {
            // booking_id kept for back-compat / single path; order_group_id drives
            // the grouped confirm in the webhook.
            booking_id: primaryBookingId,
            order_group_id: orderGroupId ?? '',
            slot_id: slotIds.length === 1 ? slotIds[0] : '',
            user_id: user.id,
          },
        },
        { idempotencyKey },
      )
    } catch (stripeErr) {
      // Surface the REAL Stripe failure (bad/again-missing key, account not
      // activated, currency not enabled, etc.) instead of the generic catch-all.
      // If this logs but the Stripe Dashboard shows no request, the key itself is
      // wrong/empty; if it logs WITH a Stripe error type/code, that's the cause.
      const e = stripeErr as { message?: string; type?: string; code?: string; statusCode?: number }
      console.error('[payment/create-intent] stripe error', {
        message: e.message,
        type: e.type,
        code: e.code,
        statusCode: e.statusCode,
        amount: amountInCents,
        userId: user.id,
        bookingIds,
      })
      return NextResponse.json(
        { error: 'stripe_error', detail: e.message ?? 'Stripe request failed', code: e.code ?? e.type ?? null },
        { status: 502 },
      )
    }

    console.log('[payment/create-intent] success', {
      userId: user.id,
      bookingId: primaryBookingId,
      orderGroupId,
      paymentIntentId: intent.id,
      amount: amountInCents,
    })
    return NextResponse.json({
      clientSecret: intent.client_secret,
      // Primary booking id: the client polls /api/booking/status?bookingId=… with
      // this for the confirmation screen (any row in the group flips to confirmed
      // together, so the primary is representative).
      bookingId: primaryBookingId,
      orderGroupId,
      amount: amountInCents,
      currency: 'hkd',
    })
  } catch (err) {
    const e = err as Error
    console.error('[payment/create-intent] error', { message: e.message, stack: e.stack })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
