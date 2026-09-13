import { NextRequest, NextResponse } from 'next/server'
import { getPaymentProvider } from '@/lib/payments'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

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
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
    }

    // Verify webhook signature
    const provider = getPaymentProvider()
    const headers: Record<string, string> = { 'stripe-signature': signature }

    if (!provider.verifyWebhookSignature(body, headers)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    // Parse webhook payload
    const event = provider.parseWebhookPayload(body)

    // Idempotency: check if we've already processed this event
    const supabase = createRouteHandlerClient({ cookies })

    const { data: existingEvent } = await supabase
      .from('webhook_events')
      .select('id')
      .eq('event_id', event.eventId || event.providerOrderNo)
      .maybeSingle()

    if (existingEvent) {
      // Already processed
      return NextResponse.json({ received: true, duplicate: true })
    }

    // Store event for idempotency
    await supabase.from('webhook_events').insert({
      event_id: event.eventId || event.providerOrderNo,
      event_type: event.eventType,
      provider: 'stripe',
      payload: event.rawPayload,
      processed_at: new Date().toISOString(),
    })

    // Handle the event based on type
    if (event.status === 'succeeded') {
      await handleSucceeded(event, supabase)
    } else if (event.status === 'failed') {
      await handleFailed(event, supabase)
    } else if (event.status === 'refunded') {
      await handleRefunded(event, supabase)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Stripe webhook error:', error)
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    )
  }
}

async function handleSucceeded(event: any, supabase: any) {
  const metadata = event.rawPayload.metadata || {}
  const bookingId = metadata.booking_id

  if (!bookingId) {
    console.error('No booking_id in metadata:', metadata)
    return
  }

  // Update booking status to confirmed
  const { error } = await supabase
    .from('bookings')
    .update({
      status: 'confirmed',
      payment_status: 'paid',
      paid_at: new Date().toISOString(),
      provider_order_no: event.providerOrderNo,
    })
    .eq('id', bookingId)

  if (error) {
    console.error('Failed to update booking:', error)
    throw error
  }
}

async function handleFailed(event: any, supabase: any) {
  const metadata = event.rawPayload.metadata || {}
  const bookingId = metadata.booking_id

  if (!bookingId) {
    console.error('No booking_id in metadata:', metadata)
    return
  }

  // Update booking status to failed
  await supabase
    .from('bookings')
    .update({
      payment_status: 'failed',
      provider_order_no: event.providerOrderNo,
    })
    .eq('id', bookingId)
}

async function handleRefunded(event: any, supabase: any) {
  // Find booking by provider_order_no
  const { data: booking } = await supabase
    .from('bookings')
    .select('id')
    .eq('provider_order_no', event.providerOrderNo)
    .maybeSingle()

  if (!booking) {
    console.error('Booking not found for refund:', event.providerOrderNo)
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
