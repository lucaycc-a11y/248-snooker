import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getServiceSupabase } from '@/lib/supabase/service'
import { verifyKpaySignature } from '@/lib/payments/kpay-sign'
import { logSiteError } from '@/lib/errors/log'
import { humanReadableCode } from '@/lib/qr/jwt'

export const runtime = 'nodejs'

// POST /api/webhooks/kpay
// 1. Verify the KPay RSA-SHA256 signature BEFORE any DB write.
// 2. Claim the event in webhook_events for idempotency (key = `kpay:${orderNo}:${status}`).
// 3. Look up booking by outTradeNo (human_code), then route to the appropriate
//    handler — success → confirm_booking / confirm_booking_group,
//    failure → release_slot_lock / release_group_locks.
// 4. Return 200 fast (KPay expects a plain 200 OK; body is ignored).
//
// IMPORTANT: Returns 401 on invalid/missing signature (KPay spec mandates 401,
// unlike Stripe which uses 400).
export async function POST(req: Request) {
  const rawBody = await req.text()

  // ── Read KPay signature headers ────────────────────────────────────────
  const timestamp = req.headers.get('k-timestamp')
  const nonceStr = req.headers.get('k-nonce-str')
  const merchantCode = req.headers.get('k-merchant-code')
  const signature = req.headers.get('k-signature')

  if (!timestamp || !nonceStr || !merchantCode || !signature) {
    console.error('[webhook/kpay] missing required headers', {
      hasTimestamp: !!timestamp,
      hasNonce: !!nonceStr,
      hasMerchantCode: !!merchantCode,
      hasSignature: !!signature,
    })
    return new NextResponse('Missing signature headers', { status: 401 })
  }

  // ── Verify signature against platform public key ───────────────────────
  const platformPublicKey = process.env.KPAY_PLATFORM_PUBLIC_KEY
  if (!platformPublicKey) {
    console.error('[webhook/kpay] KPAY_PLATFORM_PUBLIC_KEY not configured')
    return new NextResponse('Server configuration error', { status: 500 })
  }

  const isValid = verifyKpaySignature(rawBody, { timestamp, nonceStr, merchantCode, signature }, platformPublicKey)
  if (!isValid) {
    console.error('[webhook/kpay] signature_invalid', {
      merchantCode,
      timestamp: timestamp.slice(0, 10),
    })
    return new NextResponse('Invalid signature', { status: 401 })
  }

  // ── Parse payload ──────────────────────────────────────────────────────
  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>
  } catch {
    console.error('[webhook/kpay] invalid_json')
    return new NextResponse('Invalid JSON', { status: 400 })
  }

  const orderNo = String(payload.orderNo ?? payload.order_no ?? '')
  const outTradeNo = String(payload.outTradeNo ?? payload.out_trade_no ?? '')
  const status = String(payload.status ?? payload.tradeStatus ?? '')
  const eventType = String(payload.eventType ?? 'payment.update')

  if (!orderNo || !outTradeNo) {
    console.error('[webhook/kpay] missing orderNo or outTradeNo', { orderNo, outTradeNo })
    return new NextResponse('Missing order reference', { status: 400 })
  }

  console.log('[webhook/kpay] received', { orderNo, outTradeNo, status, eventType })

  // ── Map status to business action ──────────────────────────────────────
  const isSuccess = status === 'SUCCESS' || status === '2'
  const isFailed = status === 'FAIL' || status === '3'
  const isRefunded = status === '4' || status === 'REFUND'

  const supabase = getServiceSupabase()

  // ── Idempotency claim ─────────────────────────────────────────────────
  // KPay has no Stripe-style event id, so we construct one from the order
  // reference and status — each status transition is processed exactly once.
  const eventId = `kpay:${orderNo}:${status}`

  const { error: claimErr } = await supabase
    .from('webhook_events')
    .insert({ id: eventId, type: `kpay.${eventType}`, payload })

  if (claimErr) {
    if ((claimErr as { code?: string }).code !== '23505') {
      console.error('[webhook/kpay] claim_failed', {
        message: claimErr.message,
        code: (claimErr as { code?: string }).code,
        eventId,
      })
      await logSiteError('webhooks/kpay', 'error', 'webhook_events claim failed', {
        message: claimErr.message,
        code: (claimErr as { code?: string }).code,
        eventId,
      })
      return new NextResponse('Claim failed', { status: 500 })
    }
    // Duplicate — already processed or in-flight
    const { data: existing } = await supabase
      .from('webhook_events')
      .select('status')
      .eq('id', eventId)
      .single()

    if (existing?.status === 'processed') {
      console.log('[webhook/kpay] duplicate', { eventId, orderNo, status })
      return new NextResponse('OK', { status: 200 })
    }
    // else: prior attempt didn't finish → reprocess
  }

  // ── Look up booking by outTradeNo (human_code) ─────────────────────────
  const { data: booking, error: bookingErr } = await supabase
    .from('bookings')
    .select('id, user_id, order_group_id, slot_id, human_code, total_price, payment_method')
    .eq('human_code', outTradeNo)
    .maybeSingle()

  if (bookingErr) {
    console.error('[webhook/kpay] booking_lookup_failed', {
      outTradeNo,
      message: bookingErr.message,
    })
    await markWebhookFailed(supabase, eventId, `booking lookup failed: ${bookingErr.message}`)
    return new NextResponse('OK', { status: 200 })
  }

  if (!booking) {
    console.warn('[webhook/kpay] booking_not_found', { outTradeNo, orderNo })
    // No matching booking — this is unusual but not a webhook failure.
    // The outTradeNo may have been from a different system. Accept and
    // mark processed so KPay doesn't retry.
    await markWebhookProcessed(supabase, eventId)
    return new NextResponse('OK', { status: 200 })
  }

  try {
    if (isSuccess) {
      await handleSucceeded(supabase, booking, orderNo, outTradeNo, status, eventId)
    } else if (isFailed) {
      await handleFailed(supabase, booking, eventId)
    } else if (isRefunded) {
      await handleRefunded(supabase, booking, orderNo, eventId)
    } else {
      // Other statuses (pending, etc.) — just mark processed
      await markWebhookProcessed(supabase, eventId)
    }

    console.log('[webhook/kpay] success', { eventId, orderNo, status })
    return new NextResponse('OK', { status: 200 })
  } catch (err) {
    const msg = (err as Error).message
    console.error('[webhook/kpay] handler_error', {
      eventId,
      orderNo,
      status,
      message: msg,
      stack: (err as Error).stack,
    })
    await markWebhookFailed(supabase, eventId, msg)
    await logSiteError('webhooks/kpay', 'error', `${eventType} handler failed`, {
      message: msg,
      eventId,
      orderNo,
      status,
    })
    return new NextResponse('OK', { status: 200 })
  }
}

// ── Handlers ────────────────────────────────────────────────────────────────

type BookingSummary = {
  id: string
  user_id: string | null
  order_group_id: string | null
  slot_id: string | null
  human_code: string | null
  total_price: number
  payment_method: string | null
}

async function handleSucceeded(
  supabase: SupabaseClient,
  booking: BookingSummary,
  providerOrderNo: string,
  outTradeNo: string,
  status: string,
  eventId: string,
) {
  const paymentMethod = booking.payment_method ?? 'fps'

  // Grouped booking: confirm every row atomically
  if (booking.order_group_id) {
    const { data: rows, error: rowsErr } = await supabase
      .from('bookings')
      .select('id, total_price')
      .eq('order_group_id', booking.order_group_id)

    if (rowsErr) throw new Error(`group lookup failed: ${rowsErr.message}`)
    if (!rows || rows.length === 0) throw new Error(`no bookings for order_group_id ${booking.order_group_id}`)

    // Build QR codes map for every booking in the group
    const qrCodes: Record<string, string> = {}
    for (const r of rows) {
      qrCodes[r.id] = humanReadableCode(r.id)
    }

    console.log('[webhook/kpay] confirming booking group', {
      orderGroupId: booking.order_group_id,
      bookings: rows.length,
      providerOrderNo,
      paymentMethod,
    })

    const { data: rawResult, error } = await supabase.rpc('confirm_booking_group', {
      p_order_group_id: booking.order_group_id,
      p_payment_intent_id: providerOrderNo,
      p_payment_method: paymentMethod,
      p_qr_codes: qrCodes,
      p_event_id: eventId,
    })
    if (error) throw new Error(`confirm_booking_group failed: ${error.message}`)
    const result = rawResult as { success?: boolean; reason?: string; user_id?: string; booking_ids?: string[] }
    if (result?.success === false) {
      throw new Error(`confirm_booking_group rejected: ${result.reason}`)
    }

    console.log('[webhook/kpay] booking group confirmed', {
      orderGroupId: booking.order_group_id,
      bookings: result?.booking_ids?.length,
    })
    return
  }

  // Single booking
  const humanCode = booking.human_code ?? humanReadableCode(booking.id)

  console.log('[webhook/kpay] confirming booking', {
    bookingId: booking.id,
    providerOrderNo,
    paymentMethod,
  })

  const { data: rawResult, error } = await supabase.rpc('confirm_booking', {
    p_booking_id: booking.id,
    p_payment_intent_id: providerOrderNo,
    p_payment_method: paymentMethod,
    p_qr_code: humanCode,
    p_event_id: eventId,
  })
  if (error) throw new Error(`confirm_booking failed: ${error.message}`)
  const result = parseConfirmBookingResult(rawResult)
  if (result.success === false) {
    throw new Error(`confirm_booking rejected: ${result.reason}`)
  }

  console.log('[webhook/kpay] booking confirmed', {
    bookingId: result.booking_id,
    userId: result.user_id,
  })

  // Notifications: non-fatal
  try {
    const { sendBookingConfirmation } = await import('@/lib/resend/template-send')
    await sendBookingConfirmation(result.booking_id)
    await supabase.from('notification_log').insert([
      { user_id: result.user_id, booking_id: result.booking_id, channel: 'email', type: 'booking_confirmed', status: 'sent' },
      { user_id: result.user_id, booking_id: result.booking_id, channel: 'whatsapp', type: 'booking_confirmed', status: 'pending' },
    ])
  } catch (e) {
    console.error('[webhook/kpay] notification_failed', {
      message: (e as Error).message,
      bookingId: result.booking_id,
    })
  }
}

async function handleFailed(
  supabase: SupabaseClient,
  booking: BookingSummary,
  eventId: string,
) {
  if (booking.order_group_id) {
    console.log('[webhook/kpay] group payment failed, releasing locks', {
      orderGroupId: booking.order_group_id,
    })
    const { data, error } = await supabase.rpc('release_group_locks', {
      p_order_group_id: booking.order_group_id,
      p_event_id: eventId,
    })
    if (error) throw new Error(`release_group_locks failed: ${error.message}`)
    assertRpcSucceeded(data, 'release_group_locks')
    return
  }

  if (!booking.slot_id) {
    throw new Error('payment failed: booking has no slot_id')
  }
  console.log('[webhook/kpay] payment failed, releasing lock', {
    slotId: booking.slot_id,
    bookingId: booking.id,
  })
  const { data, error } = await supabase.rpc('release_slot_lock', {
    p_slot_id: booking.slot_id,
    p_event_id: eventId,
  })
  if (error) throw new Error(`release_slot_lock failed: ${error.message}`)
  assertRpcSucceeded(data, 'release_slot_lock')
}

async function handleRefunded(
  supabase: SupabaseClient,
  booking: BookingSummary,
  providerOrderNo: string,
  eventId: string,
) {
  if (booking.order_group_id) {
    console.log('[webhook/kpay] refunding booking group', {
      orderGroupId: booking.order_group_id,
    })
    const { data, error } = await supabase.rpc('refund_group', {
      p_order_group_id: booking.order_group_id,
      p_event_id: eventId,
    })
    if (error) throw new Error(`refund_group failed: ${error.message}`)
    assertRpcSucceeded(data, 'refund_group')
    return
  }

  // refund_booking looks up by stripe_payment_intent (which we reuse as
  // the provider_order_no for KPay — see 20260817 migration comment).
  console.log('[webhook/kpay] refunding booking', { bookingId: booking.id, providerOrderNo })
  const { data, error } = await supabase.rpc('refund_booking', {
    p_payment_intent_id: providerOrderNo,
    p_event_id: eventId,
  })
  if (error) throw new Error(`refund_booking failed: ${error.message}`)
  assertRpcSucceeded(data, 'refund_booking')
}

// ── Helpers ──────────────────────────────────────────────────────────────────

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
  const userId = result.user_id
  if (typeof bookingId !== 'string') {
    throw new Error('confirm_booking returned invalid booking_id')
  }
  if (userId !== null && typeof userId !== 'string') {
    throw new Error('confirm_booking returned invalid user_id')
  }

  return {
    success: true,
    booking_id: bookingId,
    booking_reference:
      typeof result.booking_reference === 'string' ? result.booking_reference : undefined,
    table_number: typeof result.table_number === 'number' ? result.table_number : 0,
    date: typeof result.date === 'string' ? result.date : '',
    start_time: typeof result.start_time === 'string' ? result.start_time : '',
    end_time: typeof result.end_time === 'string' ? result.end_time : '',
    user_id: userId,
  }
}

function assertRpcSucceeded(value: unknown, rpcName: string) {
  if (!value || typeof value !== 'object') return
  const result = value as Record<string, unknown>
  if (result.success === false) {
    const reason = typeof result.reason === 'string' ? result.reason : 'unknown'
    throw new Error(`${rpcName} rejected: ${reason}`)
  }
}

async function markWebhookProcessed(supabase: SupabaseClient, eventId: string) {
  const { error } = await supabase
    .from('webhook_events')
    .update({ status: 'processed', processed_at: new Date().toISOString() })
    .eq('id', eventId)
  if (error) throw new Error(`webhook_events processed update failed: ${error.message}`)
}

async function markWebhookFailed(supabase: SupabaseClient, eventId: string, errorMsg: string) {
  await supabase
    .from('webhook_events')
    .update({ status: 'failed', error: errorMsg })
    .eq('id', eventId)
}