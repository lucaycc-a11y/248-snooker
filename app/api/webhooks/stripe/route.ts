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
// 3. Business RPCs stamp processed status inside the same DB transaction as the
//    booking/slot mutation; unsupported events are marked processed here.
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
    console.error('[webhook/stripe] signature_invalid', { message: (err as Error).message })
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  console.log('[webhook/stripe] received', { eventId: event.id, type: event.type })

  const supabase = getServiceSupabase()

  // ── Idempotency claim ──────────────────────────────────────────────────────
  const { error: claimErr } = await supabase
    .from('webhook_events')
    .insert({ id: event.id, type: event.type, payload: event as unknown as Record<string, unknown> })

  if (claimErr) {
    if ((claimErr as { code?: string }).code !== '23505') {
      console.error('[webhook/stripe] claim_failed', {
        message: claimErr.message,
        code: (claimErr as { code?: string }).code,
        eventId: event.id,
      })
      return NextResponse.json({ error: 'claim failed' }, { status: 500 })
    }
    const { data: existing } = await supabase
      .from('webhook_events')
      .select('status')
      .eq('id', event.id)
      .single()
    if (existing?.status === 'processed') {
      console.log('[webhook/stripe] duplicate', { eventId: event.id, type: event.type })
      return NextResponse.json({ received: true, duplicate: true })
    }
    // else: prior attempt didn't finish → reprocess (RPCs are idempotent).
  }

  try {
    let statusStampedInTransaction = false
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handleSucceeded(stripe, supabase, event.data.object as Stripe.PaymentIntent, event.id)
        statusStampedInTransaction = true
        break
      case 'payment_intent.payment_failed':
        await handleFailed(supabase, event.data.object as Stripe.PaymentIntent, event.id)
        statusStampedInTransaction = true
        break
      case 'charge.refunded':
        await handleRefunded(supabase, event.data.object as Stripe.Charge, event.id)
        statusStampedInTransaction = true
        break
      default:
        break
    }

    if (!statusStampedInTransaction) {
      await markWebhookProcessed(supabase, event.id)
    }

    console.log('[webhook/stripe] success', { eventId: event.id, type: event.type })
    return NextResponse.json({ received: true })
  } catch (err) {
    const msg = (err as Error).message
    console.error('[webhook/stripe] handler_error', {
      eventId: event.id,
      type: event.type,
      message: msg,
      stack: (err as Error).stack,
    })
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

type ConfirmBookingResult =
  | {
      success: true
      booking_id: string
      booking_reference?: string
      table_number: number
      date: string
      start_time: string
      end_time: string
      user_id: string | null
    }
  | { success: false; reason: string }

function parseConfirmBookingResult(value: unknown): ConfirmBookingResult {
  if (!value || typeof value !== 'object') {
    throw new Error('confirm_booking returned invalid payload')
  }

  const result = value as Record<string, unknown>
  if (result.success === false) {
    return {
      success: false,
      reason: typeof result.reason === 'string' ? result.reason : 'unknown',
    }
  }

  const bookingId = result.booking_id
  const date = result.date
  const startTime = result.start_time
  const endTime = result.end_time
  const tableNumber = result.table_number
  const userId = result.user_id
  if (typeof bookingId !== 'string') {
    throw new Error('confirm_booking returned invalid booking_id')
  }
  if (typeof date !== 'string') {
    throw new Error('confirm_booking returned invalid date')
  }
  if (typeof startTime !== 'string') {
    throw new Error('confirm_booking returned invalid start_time')
  }
  if (typeof endTime !== 'string') {
    throw new Error('confirm_booking returned invalid end_time')
  }
  if (typeof tableNumber !== 'number') {
    throw new Error('confirm_booking returned invalid table_number')
  }
  if (userId !== null && typeof userId !== 'string') {
    throw new Error('confirm_booking returned invalid user_id')
  }

  return {
    success: true,
    booking_id: bookingId,
    booking_reference:
      typeof result.booking_reference === 'string' ? result.booking_reference : undefined,
    table_number: tableNumber,
    date,
    start_time: startTime,
    end_time: endTime,
    user_id: userId,
  }
}

async function markWebhookProcessed(supabase: SupabaseClient, eventId: string) {
  const { error } = await supabase
    .from('webhook_events')
    .update({ status: 'processed', processed_at: new Date().toISOString() })
    .eq('id', eventId)
  if (error) throw new Error(`webhook_events processed update failed: ${error.message}`)
}

function assertRpcSucceeded(value: unknown, rpcName: string) {
  if (!value || typeof value !== 'object') return
  const result = value as Record<string, unknown>
  if (result.success === false) {
    const reason = typeof result.reason === 'string' ? result.reason : 'unknown'
    throw new Error(`${rpcName} rejected: ${reason}`)
  }
}

type BookingPaymentContext = {
  total_price: number
  date: string
  start_time: string
  end_time: string
  table_number: number
  user_id: string | null
}

function parseBookingPaymentContext(value: unknown): BookingPaymentContext {
  if (!value || typeof value !== 'object') {
    throw new Error('booking amount lookup returned invalid payload')
  }
  const row = value as Record<string, unknown>
  const totalPrice = row.total_price
  const date = row.date
  const startTime = row.start_time
  const endTime = row.end_time
  const tableNumber = row.table_number
  const userId = row.user_id

  if (typeof totalPrice !== 'number') throw new Error('booking returned invalid total_price')
  if (typeof date !== 'string') throw new Error('booking returned invalid date')
  if (typeof startTime !== 'string') throw new Error('booking returned invalid start_time')
  if (typeof endTime !== 'string') throw new Error('booking returned invalid end_time')
  if (typeof tableNumber !== 'number') throw new Error('booking returned invalid table_number')
  if (userId !== null && typeof userId !== 'string') {
    throw new Error('booking returned invalid user_id')
  }

  return {
    total_price: totalPrice,
    date,
    start_time: startTime,
    end_time: endTime,
    table_number: tableNumber,
    user_id: userId,
  }
}

function addOneIsoDate(date: string): string {
  const value = new Date(`${date}T00:00:00.000Z`)
  value.setUTCDate(value.getUTCDate() + 1)
  return value.toISOString().slice(0, 10)
}

function composeSlotEndIso(date: string, startTime: string, endTime: string): string {
  const endDate = endTime <= startTime ? addOneIsoDate(date) : date
  return `${endDate}T${endTime}`
}

async function handleSucceeded(
  stripe: Stripe,
  supabase: SupabaseClient,
  pi: Stripe.PaymentIntent,
  eventId: string,
) {
  const paymentIntent = await stripe.paymentIntents.retrieve(pi.id)
  if (paymentIntent.status !== 'succeeded') {
    throw new Error('Payment intent not succeeded, refusing to confirm booking')
  }

  const orderGroupId = paymentIntent.metadata?.order_group_id
  const userId = paymentIntent.metadata?.user_id

  // Grouped (non-contiguous) booking: confirm every row in the group atomically.
  if (orderGroupId) {
    await handleGroupSucceeded(stripe, supabase, paymentIntent, orderGroupId, eventId)
    return
  }

  const bookingId = paymentIntent.metadata?.booking_id
  if (!bookingId) throw new Error('payment_intent missing booking_id metadata')

  const { data: bookingRow, error: expectedErr } = await supabase
    .from('bookings')
    .select('total_price, date, start_time, end_time, table_number, user_id')
    .eq('id', bookingId)
    .single()
  if (expectedErr) throw new Error(`booking amount lookup failed: ${expectedErr.message}`)
  const bookingContext = parseBookingPaymentContext(bookingRow)

  const expectedAmount = bookingContext.total_price * 100
  if (paymentIntent.amount !== expectedAmount) {
    throw new Error(
      `Payment amount mismatch: expected ${expectedAmount}, got ${paymentIntent.amount}`,
    )
  }

  const isFree = paymentIntent.amount === 0
  let charge: Stripe.Charge | null = null
  if (typeof paymentIntent.latest_charge === 'string' && paymentIntent.latest_charge) {
    charge = await stripe.charges.retrieve(paymentIntent.latest_charge)
  }
  const paymentMethod = mapPaymentMethod(charge, isFree)

  console.log('[webhook/stripe] confirming booking', {
    bookingId,
    userId,
    paymentIntentId: paymentIntent.id,
    paymentMethod,
    amount: paymentIntent.amount,
  })

  const startIso = `${bookingContext.date}T${bookingContext.start_time}`
  const endIso = composeSlotEndIso(
    bookingContext.date,
    bookingContext.start_time,
    bookingContext.end_time,
  )
  const qrToken = signQrToken({
    booking_id: bookingId,
    user_id: String(userId ?? bookingContext.user_id ?? ''),
    table_number: bookingContext.table_number,
    start_time: startIso,
    end_time: endIso,
  })

  // Atomic confirm: stores the QR credential, marks slot booked, releases lock,
  // confirms booking, awards points, and stamps webhook_events.status='processed'
  // in the same DB transaction.
  const { data: rawResult, error } = await supabase.rpc('confirm_booking', {
    p_booking_id: bookingId,
    p_payment_intent_id: paymentIntent.id,
    p_payment_method: paymentMethod,
    p_qr_code: qrToken,
    p_event_id: eventId,
  })
  if (error) throw new Error(`confirm_booking failed: ${error.message}`)
  const result = parseConfirmBookingResult(rawResult)
  if (result.success === false) {
    throw new Error(`confirm_booking rejected: ${result.reason}`)
  }

  console.log('[webhook/stripe] booking confirmed', {
    bookingId: result.booking_id,
    userId: result.user_id,
    bookingReference: result.booking_reference,
  })

  // Notifications: send DIRECTLY then record in notification_log (it's a post-send
  // log, not a queue). Recorded non-fatally so a notification hiccup never fails
  // an already-confirmed booking.
  try {
    // Fetch user profile for email receipt
    const { data: profile } = await supabase
      .from('users')
      .select('name, phone, preferred_locale')
      .eq('id', result.user_id)
      .single()

    if (profile?.name) {
      // Send receipt email via Resend
      const { sendBookingReceipt } = await import('@/lib/resend/send')
      await sendBookingReceipt({
        to: paymentIntent.receipt_email || '',
        booking: {
          id: result.booking_id,
          user_id: result.user_id || '',
          date: result.date,
          start_time: result.start_time,
          end_time: result.end_time,
          table_number: result.table_number,
          total_price: Math.round(paymentIntent.amount / 100),
          payment_method: paymentMethod,
        },
        paymentIntentId: paymentIntent.id,
        customerName: profile.name,
        customerPhone: profile.phone || '',
        locale: (profile.preferred_locale as 'zh-HK' | 'zh-CN' | 'en' | 'ja') || 'zh-HK',
      })
      console.log('[webhook/stripe] receipt_email_sent', { bookingId: result.booking_id })
    }

    // Log to notification_log (non-fatal)
    await supabase.from('notification_log').insert([
      { user_id: result.user_id, booking_id: result.booking_id, channel: 'email', type: 'booking_confirmed', status: 'sent' },
      { user_id: result.user_id, booking_id: result.booking_id, channel: 'whatsapp', type: 'booking_confirmed', status: 'pending' },
    ])
  } catch (e) {
    console.error('[webhook/stripe] notification_failed', {
      message: (e as Error).message,
      bookingId: result.booking_id,
    })
  }
}

// Grouped confirm: confirm every booking in an order group in one DB transaction.
// Verifies the paid amount against the SUM of the group's server-set prices, signs
// a QR per booking, then calls confirm_booking_group.
async function handleGroupSucceeded(
  stripe: Stripe,
  supabase: SupabaseClient,
  paymentIntent: Stripe.PaymentIntent,
  orderGroupId: string,
  eventId: string,
) {
  const { data: rows, error: rowsErr } = await supabase
    .from('bookings')
    .select('id, total_price, date, start_time, end_time, table_number, user_id')
    .eq('order_group_id', orderGroupId)
  if (rowsErr) throw new Error(`group lookup failed: ${rowsErr.message}`)
  if (!rows || rows.length === 0) throw new Error(`no bookings for order_group_id ${orderGroupId}`)

  const expectedAmount =
    rows.reduce((sum, r) => sum + parseBookingPaymentContext(r).total_price, 0) * 100
  if (paymentIntent.amount !== expectedAmount) {
    throw new Error(`Payment amount mismatch: expected ${expectedAmount}, got ${paymentIntent.amount}`)
  }

  let charge: Stripe.Charge | null = null
  if (typeof paymentIntent.latest_charge === 'string' && paymentIntent.latest_charge) {
    charge = await stripe.charges.retrieve(paymentIntent.latest_charge)
  }
  const paymentMethod = mapPaymentMethod(charge, false)

  // Sign a QR token per booking, keyed by booking id for confirm_booking_group.
  const qrCodes: Record<string, string> = {}
  for (const r of rows) {
    const ctx = parseBookingPaymentContext(r)
    const startIso = `${ctx.date}T${ctx.start_time}`
    const endIso = composeSlotEndIso(ctx.date, ctx.start_time, ctx.end_time)
    qrCodes[r.id] = signQrToken({
      booking_id: r.id,
      user_id: String(paymentIntent.metadata?.user_id ?? ctx.user_id ?? ''),
      table_number: ctx.table_number,
      start_time: startIso,
      end_time: endIso,
    })
  }

  console.log('[webhook/stripe] confirming booking group', {
    orderGroupId,
    bookings: rows.length,
    paymentIntentId: paymentIntent.id,
    paymentMethod,
    amount: paymentIntent.amount,
  })

  const { data: rawResult, error } = await supabase.rpc('confirm_booking_group', {
    p_order_group_id: orderGroupId,
    p_payment_intent_id: paymentIntent.id,
    p_payment_method: paymentMethod,
    p_qr_codes: qrCodes,
    p_event_id: eventId,
  })
  if (error) throw new Error(`confirm_booking_group failed: ${error.message}`)
  const result = rawResult as { success?: boolean; reason?: string; user_id?: string; booking_ids?: string[] }
  if (result?.success === false) {
    throw new Error(`confirm_booking_group rejected: ${result.reason}`)
  }

  console.log('[webhook/stripe] booking group confirmed', {
    orderGroupId,
    userId: result?.user_id,
    bookings: result?.booking_ids?.length,
  })

  // Receipt email: one combined receipt for the group (sent for the first booking;
  // non-fatal so a hiccup never fails an already-confirmed group).
  try {
    const userId = result?.user_id
    const primaryId = result?.booking_ids?.[0]
    if (userId && primaryId) {
      const { data: profile } = await supabase
        .from('users')
        .select('name, phone, preferred_locale')
        .eq('id', userId)
        .single()
      if (profile?.name) {
        const first = parseBookingPaymentContext(rows[0])
        const { sendBookingReceipt } = await import('@/lib/resend/send')
        await sendBookingReceipt({
          to: paymentIntent.receipt_email || '',
          booking: {
            id: primaryId,
            user_id: userId,
            date: first.date,
            start_time: first.start_time,
            end_time: first.end_time,
            table_number: first.table_number,
            total_price: Math.round(paymentIntent.amount / 100),
            payment_method: paymentMethod,
          },
          paymentIntentId: paymentIntent.id,
          customerName: profile.name,
          customerPhone: profile.phone || '',
          locale: (profile.preferred_locale as 'zh-HK' | 'zh-CN' | 'en' | 'ja') || 'zh-HK',
        })
      }
      await supabase.from('notification_log').insert(
        (result?.booking_ids ?? []).flatMap((bid) => [
          { user_id: userId, booking_id: bid, channel: 'email', type: 'booking_confirmed', status: 'sent' },
          { user_id: userId, booking_id: bid, channel: 'whatsapp', type: 'booking_confirmed', status: 'pending' },
        ]),
      )
    }
  } catch (e) {
    console.error('[webhook/stripe] group_notification_failed', {
      message: (e as Error).message,
      orderGroupId,
    })
  }
}

async function handleFailed(supabase: SupabaseClient, pi: Stripe.PaymentIntent, eventId: string) {
  const orderGroupId = pi.metadata?.order_group_id
  // Grouped: release every held slot in the group.
  if (orderGroupId) {
    console.log('[webhook/stripe] group payment failed, releasing locks', { orderGroupId, paymentIntentId: pi.id })
    const { data, error } = await supabase.rpc('release_group_locks', {
      p_order_group_id: orderGroupId,
      p_event_id: eventId,
    })
    if (error) throw new Error(`release_group_locks failed: ${error.message}`)
    assertRpcSucceeded(data, 'release_group_locks')
    return
  }

  const slotId = pi.metadata?.slot_id
  if (!slotId) {
    throw new Error('payment_intent.payment_failed missing slot_id metadata')
  }
  console.log('[webhook/stripe] payment failed, releasing lock', { slotId, paymentIntentId: pi.id })
  // Free the held slot immediately so it's bookable again; the RPC stamps the
  // webhook event processed in the same DB transaction.
  const { data, error } = await supabase.rpc('release_slot_lock', {
    p_slot_id: slotId,
    p_event_id: eventId,
  })
  if (error) {
    throw new Error(`release_slot_lock failed: ${error.message}`)
  }
  assertRpcSucceeded(data, 'release_slot_lock')
}

async function handleRefunded(supabase: SupabaseClient, charge: Stripe.Charge, eventId: string) {
  const pi =
    typeof charge.payment_intent === 'string'
      ? charge.payment_intent
      : charge.payment_intent?.id
  if (!pi) {
    throw new Error('charge.refunded missing payment_intent')
  }

  // If this payment intent backs a grouped booking, refund the whole group. The
  // charge event carries no metadata, so resolve the group from the booking rows.
  const { data: grouped } = await supabase
    .from('bookings')
    .select('order_group_id')
    .eq('stripe_payment_intent', pi)
    .not('order_group_id', 'is', null)
    .limit(1)
    .maybeSingle()

  if (grouped?.order_group_id) {
    console.log('[webhook/stripe] refunding booking group', { orderGroupId: grouped.order_group_id, chargeId: charge.id })
    const { data, error } = await supabase.rpc('refund_group', {
      p_order_group_id: grouped.order_group_id,
      p_event_id: eventId,
    })
    if (error) throw new Error(`refund_group failed: ${error.message}`)
    assertRpcSucceeded(data, 'refund_group')
    return
  }

  console.log('[webhook/stripe] refunding booking', { paymentIntentId: pi, chargeId: charge.id })
  // Atomic: booking → refunded, reverse points, free the slot, mark event processed.
  const { data, error } = await supabase.rpc('refund_booking', {
    p_payment_intent_id: pi,
    p_event_id: eventId,
  })
  if (error) throw new Error(`refund_booking failed: ${error.message}`)
  assertRpcSucceeded(data, 'refund_booking')
}
