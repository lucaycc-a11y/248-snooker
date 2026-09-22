import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { createClient } from '@/lib/supabase/server'
import { getServiceSupabase } from '@/lib/supabase/service'
import { calculatePrice } from '@/lib/pricing'
import { humanReadableCode } from '@/lib/qr/jwt'
import {
  loadPeriods,
  resolveTierForUser,
  slotBounds,
  periodForStart,
} from '@/lib/booking/server'
import { isSlotStillBookable, isValidSlotStart, slotStartInHongKong } from '@/lib/booking/slot-cutoff'
import { rateLimit } from '@/lib/rate-limit'
import { requireCompleteProfile } from '@/lib/auth/require-complete-profile'
import { prepareCheckout, prepareFailureStatus, releaseCheckoutHolds } from '@/lib/checkout/prepare'
import { logSiteError } from '@/lib/errors/log'

export const runtime = 'nodejs'

type Block = { date: string; startHour: number; duration: number; tableNumber: 1 | 2 }

function isValidBlock(b: unknown): b is Block {
  if (typeof b !== 'object' || b === null) return false
  const x = b as Record<string, unknown>
  return (
    typeof x.date === 'string' &&
    typeof x.startHour === 'number' &&
    typeof x.duration === 'number' &&
    (x.tableNumber === 1 || x.tableNumber === 2)
  )
}

// POST /api/booking/free-confirm  { blocks: [...], promoCode }
//
// The self-serve zero-amount path. Neither Stripe nor KPay accepts a 0-amount
// order, so a promo that covers the full subtotal cannot go through
// /api/payment/create-intent — it bails with 'Zero-amount bookings are not
// supported'. This route is the alternative rail for exactly that case.
//
// The amount is NEVER taken from the client. Slots are locked and priced
// server-side, then prepare_checkout re-derives the subtotal, reserves the promo
// usage, and writes the discounted total onto every row. Only if it reports
// total === 0 do we confirm; any other total means this request does not belong
// on this route and the caller is sent back to the payment flow.
export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const gate = await requireCompleteProfile(supabase, user.id)
    if (!gate.ok) {
      return NextResponse.json({ error: gate.error }, { status: gate.status })
    }

    const allowed = await rateLimit('free_confirm', `user:${user.id}`, 10, 60)
    if (!allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const body = await req.json().catch(() => null)
    const blocks: Block[] = Array.isArray(body?.blocks)
      ? (body.blocks as unknown[]).filter(isValidBlock)
      : []
    const promoCode = typeof body?.promoCode === 'string' ? body.promoCode.trim() : ''

    if (blocks.length === 0) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }
    // A zero total can only come from a discount. Without a code there is nothing
    // that could have brought the price to 0, so this is a malformed request.
    if (!promoCode) {
      return NextResponse.json({ error: 'promo_code_required' }, { status: 400 })
    }

    console.log('[free-confirm] attempt', { userId: user.id, blocks: blocks.length })

    const service = getServiceSupabase()
    const periods = await loadPeriods()
    const tier = await resolveTierForUser(user.id)
    const orderGroupId = blocks.length > 1 ? randomUUID() : null
    const bookingIds: string[] = []

    for (const block of blocks) {
      if (!isValidSlotStart(block.date, block.startHour)) {
        return NextResponse.json({ error: 'Invalid slot' }, { status: 400 })
      }
      if (!isSlotStillBookable(slotStartInHongKong(block.date, block.startHour))) {
        return NextResponse.json({ error: 'Slot unavailable', reason: 'booking_cutoff' }, { status: 409 })
      }

      const { slotStart, slotEnd } = slotBounds(block.date, block.startHour, block.duration)
      const quote = calculatePrice(slotStart, slotEnd, tier, periods)
      // A 0 here is a pricing misconfig, not a discount — the discount is applied
      // later by prepare_checkout. Bail rather than confirm a mispriced booking.
      if (quote.amountInCents <= 0) {
        return NextResponse.json({ error: 'Invalid price for slot' }, { status: 400 })
      }

      const startTime = `${String(block.startHour).padStart(2, '0')}:00:00`
      const { data: lockData, error: lockError } = await service.rpc('find_or_lock_slot', {
        p_user_id: user.id,
        p_date: block.date,
        p_start_time: startTime,
        p_duration_hours: block.duration,
        p_table_number: block.tableNumber,
        p_price: quote.total,
        p_lock_minutes: 15,
      })
      if (lockError || !lockData?.success) {
        console.error('[free-confirm] lock_failed', { message: lockError?.message, block })
        return NextResponse.json({ error: 'Could not lock slot', detail: lockError?.message }, { status: 409 })
      }

      const slotId = lockData.slot_id as string
      const period = periodForStart(
        block.startHour,
        slotStart.getDay() === 0 || slotStart.getDay() === 6,
        periods,
      )
      const endHour = block.startHour + block.duration
      const endTime = `${String(endHour % 24).padStart(2, '0')}:00:00`

      const newId = randomUUID()
      const { data: inserted, error: insErr } = await service
        .from('bookings')
        .insert({
          id: newId,
          user_id: user.id,
          slot_id: slotId,
          date: block.date,
          start_time: startTime,
          end_time: endTime,
          duration_hours: block.duration,
          period,
          total_price: quote.total,
          // Pre-discount snapshot prepare_checkout re-derives the subtotal from.
          base_price: quote.total,
          subtotal: quote.total,
          status: 'pending',
          table_number: block.tableNumber,
          // Stays false: is_free_booking marks an ADMIN comp, and confirm_booking
          // reads it to skip awarding points. A promo-covered booking still earns
          // points on its pre-discount value, so flagging it here would silently
          // strip the customer's points.
          is_free_booking: false,
          payment_method: 'free',
          payment_provider: null,
          order_group_id: orderGroupId,
          human_code: humanReadableCode(newId),
        })
        .select('id')
        .single()
      if (insErr || !inserted) {
        console.error('[free-confirm] insert_failed', { message: insErr?.message })
        await logSiteError('booking/free-confirm', 'error', 'pending booking insert failed', {
          message: insErr?.message,
          userId: user.id,
          slotId,
        })
        return NextResponse.json({ error: 'Could not create booking' }, { status: 500 })
      }

      bookingIds.push(inserted.id)
    }

    const primaryBookingId = bookingIds[0]

    // Reserve the promo and write the discounted total onto every row. This is the
    // ONLY authority on the amount — the client's claim of a $0 total is ignored.
    const outcome = await prepareCheckout(service, {
      bookingId: primaryBookingId,
      userId: user.id,
      promoCode,
      points: 0,
    })
    if (!outcome.ok) {
      const { reason, availablePoints, minCartAmount } = outcome.failure
      console.log('[free-confirm] prepare_checkout rejected', { bookingId: primaryBookingId, reason })
      return NextResponse.json(
        {
          error: reason,
          ...(availablePoints !== undefined ? { availablePoints } : {}),
          ...(minCartAmount !== undefined ? { minCartAmount } : {}),
        },
        { status: prepareFailureStatus(reason) },
      )
    }

    const prepared = outcome.prepared
    // The gate. A non-zero total means the promo does not in fact cover the
    // booking, so this request must go through the paid rail instead. Release the
    // hold we just took, or the code stays locked against an abandoned attempt.
    if (prepared.total !== 0) {
      console.warn('[free-confirm] non_zero_total', {
        bookingId: primaryBookingId,
        total: prepared.total,
      })
      await releaseCheckoutHolds(service, { bookingId: primaryBookingId, orderGroupId })
      return NextResponse.json(
        { error: 'payment_required', total: prepared.total },
        { status: 400 },
      )
    }

    // Confirm through the same RPCs the payment webhooks use, so the promo hold is
    // redeemed (consume_checkout_discount) and points are awarded identically.
    if (orderGroupId) {
      const qrCodes = bookingIds.map((id) => humanReadableCode(id))
      const { data: rawResult, error: confirmError } = await service.rpc('confirm_booking_group', {
        p_order_group_id: orderGroupId,
        p_payment_intent_id: `promo_${primaryBookingId}`,
        p_payment_method: 'free',
        p_qr_codes: qrCodes,
        p_event_id: null,
      })
      if (confirmError) {
        console.error('[free-confirm] confirm_group_failed', { orderGroupId, message: confirmError.message })
        return NextResponse.json({ error: 'Confirm failed', detail: confirmError.message }, { status: 500 })
      }
      const result = rawResult as { success?: boolean; reason?: string }
      if (result?.success === false) {
        return NextResponse.json({ error: 'Confirm rejected', detail: result.reason }, { status: 500 })
      }
    } else {
      const { data: rawResult, error: confirmError } = await service.rpc('confirm_booking', {
        p_booking_id: primaryBookingId,
        p_payment_intent_id: `promo_${primaryBookingId}`,
        p_payment_method: 'free',
        p_qr_code: humanReadableCode(primaryBookingId),
        p_event_id: null,
      })
      if (confirmError) {
        console.error('[free-confirm] confirm_failed', { bookingId: primaryBookingId, message: confirmError.message })
        return NextResponse.json({ error: 'Confirm failed', detail: confirmError.message }, { status: 500 })
      }
      const result = rawResult as { success?: boolean; reason?: string }
      if (result?.success === false) {
        return NextResponse.json({ error: 'Confirm rejected', detail: result.reason }, { status: 500 })
      }
    }

    // Confirmation emails — non-fatal, same helper as the payment webhooks.
    for (const bookingId of bookingIds) {
      try {
        const { sendBookingConfirmation } = await import('@/lib/resend/template-send')
        await sendBookingConfirmation(bookingId)
      } catch (e) {
        console.error('[free-confirm] confirmation_email_failed', {
          bookingId,
          message: (e as Error).message,
        })
      }
    }

    console.log('[free-confirm] success', { userId: user.id, bookingIds, code: prepared.code })

    return NextResponse.json({
      success: true,
      primaryBookingId,
      bookingIds,
    })
  } catch (err) {
    const e = err as Error
    console.error('[free-confirm] error', { message: e.message, stack: e.stack })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
