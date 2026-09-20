import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/service'
import { getStripe } from '@/lib/stripe/server'
import { checkAmountMatch, logAmountMismatch } from '@/lib/payments/reconciliation'

export const runtime = 'nodejs'

/**
 * Stripe webhook handler — processes payment_intent.succeeded,
 * payment_intent.payment_failed, charge.refunded events.
 * Verifies signature, enforces idempotency, updates booking status.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.text()
    const signature = req.headers.get('stripe-signature')

    if (!signature) {
      console.error('[Stripe] webhook: missing signature')
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
    }

    // Verify webhook signature using Stripe SDK directly
    const stripe = getStripe()
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

    if (!webhookSecret) {
      console.error('[Stripe] webhook: STRIPE_WEBHOOK_SECRET not configured')
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
    }

    let event: any
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    } catch (err) {
      console.error('[Stripe] webhook: signature verification failed', { error: (err as Error).message })
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    console.log('[Stripe] webhook received', { type: event.type, id: event.id })

    console.log('[Stripe] webhook received', { type: event.type, id: event.id })

    // Idempotency: check if we've already processed this event
    const supabase = getServiceSupabase()

    const { data: existingEvent } = await supabase
      .from('webhook_events')
      .select('id')
      .eq('event_id', event.id)
      .maybeSingle()

    if (existingEvent) {
      console.log('[Stripe] webhook: duplicate event', { eventId: event.id })
      return NextResponse.json({ received: true, duplicate: true })
    }

    // Store event for idempotency
    await supabase.from('webhook_events').insert({
      event_id: event.id,
      event_type: event.type,
      provider: 'stripe',
      payload: event.data.object,
      processed_at: new Date().toISOString(),
    })

    // Handle the event based on type
    if (event.type === 'payment_intent.succeeded') {
      await handleSucceeded(event, supabase)
    } else if (event.type === 'payment_intent.payment_failed') {
      await handleFailed(event, supabase)
    } else if (event.type === 'charge.refunded') {
      await handleRefunded(event, supabase)
    } else {
      console.log('[Stripe] webhook: unhandled event type', { type: event.type })
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('[Stripe] webhook error:', error)
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    )
  }
}

async function handleSucceeded(event: any, supabase: any) {
  const intent = event.data.object
  const metadata = intent.metadata || {}
  const bookingId = metadata.booking_id

  if (!bookingId) {
    console.error('[Stripe] webhook: no booking_id in metadata', { metadata, intentId: intent.id })
    return
  }

  console.log('[Stripe] webhook: payment succeeded', { bookingId, intentId: intent.id })

  // Amount invariant with enhanced reconciliation. Re-check the amount at webhook
  // time (not just at create-intent) because the booking's total_price could have
  // changed between intent creation and payment completion (though this should be
  // rare with proper locking). Covers three scenarios:
  //   1. Match: confirm normally
  //   2. Overpaid: confirm booking (customer paid more than required) but flag for
  //      support follow-up — do not silently keep excess without disclosure
  //   3. Underpaid: do NOT confirm booking, show contact-support message to user
  const { data: rows } = await supabase
    .from('bookings')
    .select('id, total_price, order_group_id, status, user_id, payment_method')
    .eq('id', bookingId)

  const bookingRow = rows?.[0]
  if (!bookingRow) {
    console.error('[Stripe] webhook: booking not found', { bookingId, intentId: intent.id })
    return
  }

  const amountCheck = checkAmountMatch(Number(bookingRow.total_price), intent.amount)

  if (!amountCheck.matches) {
    logAmountMismatch('webhook', {
      bookingId,
      providerOrderNo: intent.id,
      userId: bookingRow.user_id,
      requiredCents: amountCheck.requiredCents,
      actualCents: amountCheck.actualCents,
      scenario: amountCheck.scenario!,
      discrepancyCents: amountCheck.discrepancyCents!,
    })

    if (amountCheck.scenario === 'underpaid') {
      // Underpaid: do NOT confirm. Park the booking in payment_review state so
      // polling shows "contact support" and ops can manually reconcile.
      console.error('[Stripe] webhook: UNDERPAID — not confirming', {
        bookingId,
        intentId: intent.id,
        chargedCents: intent.amount,
        requiredCents: amountCheck.requiredCents,
        shortfallCents: Math.abs(amountCheck.discrepancyCents!),
      })
      await supabase
        .from('bookings')
        .update({
          status: 'payment_review',
          payment_provider: 'stripe',
          provider_order_no: intent.id,
          stripe_payment_intent: intent.id,
        })
        .eq('id', bookingId)
      return
    } else if (amountCheck.scenario === 'overpaid') {
      // Overpaid: confirm booking (customer paid enough) but log prominently for
      // support follow-up. The excess must be flagged — do not silently retain it.
      console.warn('[Stripe] webhook: OVERPAID — confirming but flagging for support', {
        bookingId,
        intentId: intent.id,
        chargedCents: intent.amount,
        requiredCents: amountCheck.requiredCents,
        excessCents: amountCheck.discrepancyCents!,
      })
      // Continue to confirmation below, but the log above ensures ops visibility
    }
  }

  // If already confirmed (proactive polling beat the webhook), skip to avoid
  // duplicate notifications. The idempotent RPC would handle this, but skipping
  // early saves a DB round-trip.
  if (bookingRow.status === 'confirmed') {
    console.log('[Stripe] webhook: already confirmed (proactive polling)', { bookingId, intentId: intent.id })
    return
  }

  // Use the same idempotent RPC as the proactive polling endpoint. This ensures
  // both paths generate QR codes, send notifications, and update payment_attempts
  // identically, preventing the race condition where a user completes payment
  // but sees "未能確認結果" because the webhook arrived late.
  try {
    if (bookingRow.order_group_id) {
      // Grouped booking: confirm all siblings
      const { data: groupRows, error: groupErr } = await supabase
        .from('bookings')
        .select('id, total_price')
        .eq('order_group_id', bookingRow.order_group_id)

      if (groupErr || !groupRows || groupRows.length === 0) {
        console.error('[Stripe] webhook: failed to fetch group bookings', {
          orderGroupId: bookingRow.order_group_id,
          error: groupErr,
        })
        throw groupErr || new Error('Group bookings not found')
      }

      // Generate QR codes for all bookings in the group
      const { humanReadableCode } = await import('@/lib/qr/jwt')
      const qrCodes: Record<string, string> = {}
      for (const r of groupRows) {
        qrCodes[r.id] = humanReadableCode(r.id)
      }

      console.log('[Stripe] webhook: confirm_booking_group', {
        orderGroupId: bookingRow.order_group_id,
        bookings: groupRows.length,
        intentId: intent.id,
        eventId: event.id,
      })

      await supabase.rpc('confirm_booking_group', {
        p_order_group_id: bookingRow.order_group_id,
        p_payment_intent_id: intent.id,
        p_payment_method: bookingRow.payment_method || 'card',
        p_qr_codes: qrCodes,
        p_event_id: event.id,
      })
    } else {
      // Single booking
      const { humanReadableCode } = await import('@/lib/qr/jwt')
      const humanCode = humanReadableCode(bookingId)

      console.log('[Stripe] webhook: confirm_booking', {
        bookingId,
        intentId: intent.id,
        eventId: event.id,
      })

      await supabase.rpc('confirm_booking', {
        p_booking_id: bookingId,
        p_payment_intent_id: intent.id,
        p_payment_method: bookingRow.payment_method || 'card',
        p_qr_code: humanCode,
        p_event_id: event.id,
      })
    }

    // Send confirmation email and log notifications
    try {
      const { sendBookingConfirmation } = await import('@/lib/resend/template-send')
      await sendBookingConfirmation(bookingId)
      await supabase.from('notification_log').insert([
        { user_id: bookingRow.user_id, booking_id: bookingId, channel: 'email', type: 'booking_confirmed', status: 'sent' },
        { user_id: bookingRow.user_id, booking_id: bookingId, channel: 'whatsapp', type: 'booking_confirmed', status: 'pending' },
      ])
    } catch (e) {
      console.error('[Stripe] webhook: notification failed', {
        bookingId,
        message: (e as Error).message,
      })
      // Non-fatal — the booking is confirmed, notification is best-effort
    }

    // Mark payment attempt complete
    try {
      await supabase.rpc('complete_payment_attempt', {
        p_provider_order_no: intent.id,
        p_provider: 'stripe',
      })
    } catch {
      // Non-fatal
    }

    console.log('[Stripe] webhook: confirmation complete', { bookingId, intentId: intent.id })
  } catch (error) {
    console.error('[Stripe] webhook: confirmation RPC failed', {
      bookingId,
      intentId: intent.id,
      error: (error as Error).message,
    })
    throw error
  }
}

async function handleFailed(event: any, supabase: any) {
  const intent = event.data.object
  const metadata = intent.metadata || {}
  const bookingId = metadata.booking_id

  if (!bookingId) {
    console.error('[Stripe] webhook: no booking_id in metadata', { metadata, intentId: intent.id })
    return
  }

  console.log('[Stripe] webhook: payment failed', { bookingId, intentId: intent.id })

  // Update booking status to failed
  // Don't filter by payment_provider since it may be null
  await supabase
    .from('bookings')
    .update({
      status: 'payment_failed',
      payment_provider: 'stripe',
      provider_order_no: intent.id,
      stripe_payment_intent: intent.id,
    })
    .eq('id', bookingId)
}

async function handleRefunded(event: any, supabase: any) {
  const charge = event.data.object
  const paymentIntentId = charge.payment_intent

  if (!paymentIntentId) {
    console.error('[Stripe] webhook: no payment_intent in refund event', { chargeId: charge.id })
    return
  }

  console.log('[Stripe] webhook: refund processed', { paymentIntentId, chargeId: charge.id })

  // Find booking by provider_order_no or stripe_payment_intent
  const { data: booking } = await supabase
    .from('bookings')
    .select('id')
    .or(`provider_order_no.eq.${paymentIntentId},stripe_payment_intent.eq.${paymentIntentId}`)
    .maybeSingle()

  if (!booking) {
    console.error('[Stripe] webhook: booking not found for refund', { paymentIntentId })
    return
  }

  // Update booking status to refunded
  await supabase
    .from('bookings')
    .update({
      status: 'cancelled',
      refunded_at: new Date().toISOString(),
    })
    .eq('id', booking.id)
}
