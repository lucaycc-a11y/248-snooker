import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe/server'

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
    const supabase = await createClient()

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

  // Update booking status to confirmed
  const { error } = await supabase
    .from('bookings')
    .update({
      status: 'confirmed',
      payment_status: 'paid',
      paid_at: new Date().toISOString(),
      provider_order_no: intent.id,
    })
    .eq('id', bookingId)
    .eq('payment_provider', 'stripe')

  if (error) {
    console.error('[Stripe] webhook: failed to update booking', { error, bookingId })
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
  await supabase
    .from('bookings')
    .update({
      payment_status: 'failed',
      provider_order_no: intent.id,
    })
    .eq('id', bookingId)
    .eq('payment_provider', 'stripe')
}

async function handleRefunded(event: any, supabase: any) {
  const charge = event.data.object
  const paymentIntentId = charge.payment_intent

  if (!paymentIntentId) {
    console.error('[Stripe] webhook: no payment_intent in refund event', { chargeId: charge.id })
    return
  }

  console.log('[Stripe] webhook: refund processed', { paymentIntentId, chargeId: charge.id })

  // Find booking by provider_order_no
  const { data: booking } = await supabase
    .from('bookings')
    .select('id')
    .eq('provider_order_no', paymentIntentId)
    .eq('payment_provider', 'stripe')
    .maybeSingle()

  if (!booking) {
    console.error('[Stripe] webhook: booking not found for refund', { paymentIntentId })
    return
  }

  // Update booking status to refunded
  await supabase
    .from('bookings')
    .update({
      payment_status: 'refunded',
      status: 'cancelled',
      refunded_at: new Date().toISOString(),
    })
    .eq('id', booking.id)
}
