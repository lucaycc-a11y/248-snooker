import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getStripe } from '@/lib/stripe/server'
import { getServiceSupabase } from '@/lib/supabase/service'
import { signQrToken } from '@/lib/qr/jwt'

export const runtime = 'nodejs'

// POST /api/webhooks/stripe
// 1. Verify the Stripe signature against STRIPE_WEBHOOK_SECRET BEFORE any DB write.
// 2. Claim event.id in webhook_events for idempotency.
// 3. Dispatch; mark processed/failed.
export async function POST(req: Request) {
  const stripe = getStripe()

  const rawBody = await req.text() // RAW body — required for signature verification
  const sig = req.headers.get('stripe-signature')
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!sig || !webhookSecret) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret)
  } catch (err) {
    console.error('stripe_signature_invalid', (err as Error).message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = getServiceSupabase()

  // ── Idempotency claim ──────────────────────────────────────────────────────
  const { error: claimErr } = await supabase
    .from('webhook_events')
    .insert({ id: event.id, type: event.type, payload: event as unknown as Record<string, unknown> })

  if (claimErr) {
    if ((claimErr as { code?: string }).code !== '23505') {
      console.error('webhook_claim_failed', claimErr.message)
      return NextResponse.json({ error: 'claim failed' }, { status: 500 })
    }
    const { data: existing } = await supabase
      .from('webhook_events')
      .select('status')
      .eq('id', event.id)
      .single()
    if (existing?.status === 'processed') {
      return NextResponse.json({ received: true, duplicate: true })
    }
    // else: prior attempt didn't finish → reprocess (RPCs are idempotent).
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handleSucceeded(stripe, supabase, event.data.object as Stripe.PaymentIntent)
        break
      case 'payment_intent.payment_failed':
        await handleFailed(supabase, event.data.object as Stripe.PaymentIntent)
        break
      case 'charge.refunded':
        await handleRefunded(supabase, event.data.object as Stripe.Charge)
        break
      default:
        break
    }

    await supabase
      .from('webhook_events')
      .update({ status: 'processed', processed_at: new Date().toISOString() })
      .eq('id', event.id)

    return NextResponse.json({ received: true })
  } catch (err) {
    const msg = (err as Error).message
    console.error('webhook_handler_error', event.type, msg)
    await supabase
      .from('webhook_events')
      .update({ status: 'failed', error: msg })
      .eq('id', event.id)
    return NextResponse.json({ error: 'handler failed' }, { status: 500 })
  }
}

// Map Stripe's method into the bookings.payment_method enum
// (card|apple_pay|google_pay|alipay_hk|wechat_pay|free). Apple/Google Pay arrive
// as type='card' with a wallet sub-type, so we inspect the wallet, not just type.
function mapPaymentMethod(charge: Stripe.Charge | null, isFree: boolean): string {
  if (isFree) return 'free'
  const d = charge?.payment_method_details
  if (!d) return 'card'
  if (d.type === 'card') {
    const wallet = d.card?.wallet?.type
    if (wallet === 'apple_pay') return 'apple_pay'
    if (wallet === 'google_pay') return 'google_pay'
    return 'card'
  }
  if (d.type === 'alipay') return 'alipay_hk'
  if (d.type === 'wechat_pay') return 'wechat_pay'
  return 'card'
}

async function handleSucceeded(
  stripe: Stripe,
  supabase: SupabaseClient,
  pi: Stripe.PaymentIntent,
) {
  const bookingId = pi.metadata?.booking_id
  const userId = pi.metadata?.user_id
  if (!bookingId) throw new Error('payment_intent missing booking_id metadata')

  const isFree = pi.amount === 0
  let charge: Stripe.Charge | null = null
  if (typeof pi.latest_charge === 'string' && pi.latest_charge) {
    charge = await stripe.charges.retrieve(pi.latest_charge)
  }
  const paymentMethod = mapPaymentMethod(charge, isFree)

  // Atomic confirm: marks slot booked, releases lock, confirms booking, awards
  // points (ledger insert + users.points update → fires update_tier_trigger).
  const { data: result, error } = await supabase.rpc('confirm_booking', {
    p_booking_id: bookingId,
    p_payment_intent_id: pi.id,
    p_payment_method: paymentMethod,
    p_total_price: Math.round(pi.amount / 100), // cents → HK$
    p_is_free: isFree,
  })
  if (error) throw new Error(`confirm_booking failed: ${error.message}`)
  if (result && result.success === false) {
    throw new Error(`confirm_booking rejected: ${result.reason}`)
  }

  // Build the QR access token. start_time/end_time are `time`, date is `date` —
  // compose full ISO timestamps. signQrToken sets exp = start + 5 min.
  const startIso = `${result.date}T${result.start_time}`
  const endIso = `${result.date}T${result.end_time}`
  const qrToken = signQrToken({
    booking_id: String(result.booking_id),
    user_id: String(userId ?? result.user_id ?? ''),
    table_number: Number(result.table_number ?? 0),
    start_time: startIso,
    end_time: endIso,
  })

  // bookings.qr_code holds the signed JWT directly (verified: there is no separate
  // qr_token column). This write is the user's ENTRY credential — if it fails the
  // booking is confirmed + paid but unenterable, so throw to mark the event
  // 'failed' and let Stripe retry (confirm_booking is idempotent, so the retry
  // re-runs cleanly and just re-writes the QR).
  const { error: qrErr } = await supabase
    .from('bookings')
    .update({ qr_code: qrToken })
    .eq('id', result.booking_id)
  if (qrErr) throw new Error(`qr_code write failed: ${qrErr.message}`)

  // Notifications: send DIRECTLY then record in notification_log (it's a post-send
  // log, not a queue). The actual Resend/WhatsApp dispatch is the remaining
  // integration — wire lib/resend + lib/twilio here. Recorded non-fatally so a
  // notification hiccup never fails an already-confirmed booking.
  // TODO(notify): call Resend (email) + WhatsApp (Twilio) before logging.
  try {
    await supabase.from('notification_log').insert([
      { user_id: result.user_id, booking_id: result.booking_id, channel: 'email', type: 'booking_confirmed', status: 'pending' },
      { user_id: result.user_id, booking_id: result.booking_id, channel: 'whatsapp', type: 'booking_confirmed', status: 'pending' },
    ])
  } catch (e) {
    console.error('notification_log_insert_failed', (e as Error).message)
  }
}

async function handleFailed(supabase: SupabaseClient, pi: Stripe.PaymentIntent) {
  const slotId = pi.metadata?.slot_id
  if (!slotId) return
  // Free the held slot immediately so it's bookable again.
  const { error } = await supabase.rpc('release_slot_lock', { p_slot_id: slotId })
  if (error) console.error('release_slot_lock_failed', error.message)
}

async function handleRefunded(supabase: SupabaseClient, charge: Stripe.Charge) {
  const pi =
    typeof charge.payment_intent === 'string'
      ? charge.payment_intent
      : charge.payment_intent?.id
  if (!pi) return
  // Atomic: booking → refunded, reverse points, free the slot.
  const { error } = await supabase.rpc('refund_booking', { p_payment_intent_id: pi })
  if (error) throw new Error(`refund_booking failed: ${error.message}`)
}
