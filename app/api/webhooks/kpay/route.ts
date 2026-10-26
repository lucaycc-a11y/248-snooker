import { NextResponse } from 'next/server'
import crypto from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'
import { verifyKpaySignature, toPem } from '@/lib/payments/kpay-sign'
import { logSiteError } from '@/lib/errors/log'
import { humanReadableCode } from '@/lib/qr/jwt'
import { rateLimit } from '@/lib/rate-limit'
import { getClientIp } from '@/lib/security/audit-log'
import { parkPaidBookingForReview } from '@/lib/payments/park-for-review'
import { logPaymentEvent } from '@/lib/payments/payment-events'
import { getLiveKPayState } from '@/lib/payments/live-order'
import { isPaymentFreezeActive } from '@/lib/payments/freeze-flag'

export const runtime = 'nodejs'

// POST /api/webhooks/kpay
// 1. Verify the KPay RSA-SHA256 signature BEFORE any DB write.
// 2. Claim the event in webhook_events for idempotency (key = `kpay:${orderNo}:${result}`).
// 3. Look up booking by outTradeNo (human_code), then route to the appropriate
//    handler — success → confirm_booking / confirm_booking_group,
//    failure → release_slot_lock / release_group_locks.
// 4. Return 200 fast (KPay expects a plain 200 OK; body is ignored).
//
// IMPORTANT: Returns 401 on invalid/missing signature (KPay spec mandates 401,
// unlike Stripe which uses 400).
// Failed-signature / malformed-header attempts are throttled per IP. Legitimate
// KPay callbacks always verify, so counting only FAILURES never affects them.
async function rejectUnauthorized(req: Request, body: string): Promise<NextResponse> {
  const ip = getClientIp(req)
  const allowed = await rateLimit('kpay_webhook_fail', `ip:${ip}`, 20, 60)
  if (!allowed) return new NextResponse('Too many requests', { status: 429 })
  return new NextResponse(body, { status: 401 })
}

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
    return rejectUnauthorized(req, 'Missing signature headers')
  }

  // ── Verify signature against platform public key ───────────────────────
  // The env var holds RAW base64 (no PEM armour), which node:crypto rejects with
  // "DECODER routines::unsupported". toPem() must wrap it before verification —
  // KPayProvider's constructor does the same for its own copy of this key.
  const rawPlatformPublicKey = process.env.KPAY_PLATFORM_PUBLIC_KEY
  if (!rawPlatformPublicKey) {
    console.error('[webhook/kpay] KPAY_PLATFORM_PUBLIC_KEY not configured')
    return new NextResponse('Server configuration error', { status: 500 })
  }

  let platformPublicKey: string
  try {
    platformPublicKey = toPem(rawPlatformPublicKey, 'PUBLIC KEY')
    crypto.createPublicKey(platformPublicKey)
  } catch (e) {
    console.error('[webhook/kpay] KPAY_PLATFORM_PUBLIC_KEY 格式錯誤，parse 唔到', {
      message: (e as Error).message,
    })
    await logSiteError('webhooks/kpay', 'error', 'platform public key unparseable', {
      message: (e as Error).message,
    })
    return new NextResponse('Server configuration error', { status: 500 })
  }

  const isValid = verifyKpaySignature(rawBody, { timestamp, nonceStr, merchantCode, signature }, platformPublicKey)
  if (!isValid) {
    console.error('[webhook/kpay] signature_invalid', {
      merchantCode,
      timestamp: timestamp.slice(0, 10),
    })
    return rejectUnauthorized(req, 'Invalid signature')
  }

  // ── Merchant code must be OURS (signature covers it, this pins it) ─────
  const ourMerchantCode = (process.env.KPAY_MERCHANT_CODE ?? '').trim()
  if (ourMerchantCode && merchantCode.trim() !== ourMerchantCode) {
    console.error('[webhook/kpay] merchant_code_mismatch', { merchantCode })
    await logSiteError('webhooks/kpay', 'error', 'merchant code mismatch', { merchantCode })
    return rejectUnauthorized(req, 'Invalid merchant')
  }

  // ── Timestamp freshness check (defense-in-depth against replay) ────────
  // The idempotency key alone makes replays harmless (orderNo is unique),
  // but rejecting stale webhooks early reduces DB load and detects attacks faster.
  const webhookTimestamp = Number.parseInt(timestamp, 10)
  const nowMs = Date.now()
  const ageMs = nowMs - webhookTimestamp
  const MAX_AGE_MS = 10 * 60 * 1000 // 10 minutes

  if (Number.isNaN(webhookTimestamp)) {
    console.warn('[webhook/kpay] invalid_timestamp', { timestamp })
    return new NextResponse('Webhook timestamp invalid', { status: 401 })
  }
  // A signed delivery older than 10 minutes is no longer rejected outright: KPay
  // retries a failed delivery later, and refusing it would leave a PAID order
  // unconfirmed. A stale success is instead re-verified against KPay (see below).
  const staleDelivery = ageMs > MAX_AGE_MS
  if (staleDelivery) {
    console.warn('[webhook/kpay] stale_timestamp', {
      timestamp,
      ageMinutes: Math.floor(ageMs / 60000),
      maxMinutes: 10,
    })
  }

  if (ageMs < -60000) {
    // Clock skew > 1 min in the future — likely tampered or server clock wrong
    console.warn('[webhook/kpay] future_timestamp', {
      timestamp,
      skewMinutes: Math.floor(-ageMs / 60000),
    })
    return new NextResponse('Webhook timestamp in future', { status: 401 })
  }

  // ── Parse payload ──────────────────────────────────────────────────────
  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>
  } catch {
    console.error('[webhook/kpay] invalid_json')
    return new NextResponse('Invalid JSON', { status: 400 })
  }

  if (
    ourMerchantCode &&
    typeof payload.merchantCode === 'string' &&
    payload.merchantCode.trim() !== ourMerchantCode
  ) {
    console.error('[webhook/kpay] payload_merchant_code_mismatch', { merchantCode: payload.merchantCode })
    await logSiteError('webhooks/kpay', 'error', 'payload merchant code mismatch', {
      merchantCode: payload.merchantCode,
    })
    return rejectUnauthorized(req, 'Invalid merchant')
  }

  const orderNo = String(payload.orderNo ?? payload.order_no ?? '')
  const outTradeNo = String(payload.outTradeNo ?? payload.out_trade_no ?? '')
  // KPay's "訂單狀態更新通知" payload carries the order state in `result`
  // (values 1–6), NOT `status` / `tradeStatus` — those are absent/empty in real
  // callbacks.  `status`/`tradeStatus` are kept only as a fallback for any
  // proxy or future format that still uses them.  See `mapKPayResult` in
  // lib/payments/kpay.ts for the canonical mapping.
  // Production SALES callbacks carry `transactionState` (2 = paid, with
  // transactionStateDesc "00:承兌或交易成功") and no `result`. Without this
  // mapping a paid order fell through to the no-op branch and was never
  // confirmed. Only success is mapped from it; other states keep their old
  // handling.
  const transactionState = payload.transactionState
  // transactionState 3 ("UN:訂單已關閉") means KPay closed the order unpaid, so the
  // customer can no longer pay it. It is the signal that frozen holds may be released.
  const result =
    String(payload.result ?? payload.status ?? payload.tradeStatus ?? '') ||
    (transactionState === 2 || transactionState === '2' ? '2' : '') ||
    (transactionState === 3 || transactionState === '3' ? '3' : '')
  const closedByState =
    !(payload.result ?? payload.status ?? payload.tradeStatus) && (transactionState === 3 || transactionState === '3')
  const eventType = String(payload.eventType ?? 'payment.update')

  if (!orderNo || !outTradeNo) {
    console.error('[webhook/kpay] missing orderNo or outTradeNo', { orderNo, outTradeNo })
    return new NextResponse('Missing order reference', { status: 400 })
  }

  console.log('[webhook/kpay] received', { orderNo, outTradeNo, result, eventType })

  // ── Map status to business action ──────────────────────────────────────
  // KPay `result` values: '1'=pending, '2'=success, '3'=failed, '4'=refunded,
  // '5'=cancelled, '6'=closed.  Unknown/empty values never map to success —
  // they fall through to the idempotent no-op branch instead of confirming.
  const isSuccess = result === '2' || result === 'SUCCESS'
  const isFailed = result === '3' || result === 'FAIL'
  const isRefunded = result === '4' || result === 'REFUND'

  const supabase = getLegacyServiceSupabase()

  // ── Idempotency claim ─────────────────────────────────────────────────
  // KPay has no Stripe-style event id, so we construct one from the order
  // reference and status — each status transition is processed exactly once.
  const eventId = `kpay:${orderNo}:${result}`

  const { error: claimErr } = await supabase
    .from('webhook_events')
    .insert({ id: eventId, type: `kpay.${eventType}`, payload, provider: 'kpay' })

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
      console.log('[webhook/kpay] duplicate', { eventId, orderNo, result })
      return new NextResponse('OK', { status: 200 })
    }
    // else: prior attempt didn't finish → reprocess
  }

  // ── Space Pilot renewal branch ────────────────────────────────────────
  // If outTradeNo matches a renewal_orders.id, handle it here and return early.
  // This never touches the ordinary booking confirmation path.
  const { data: renewalOrder, error: renewalLookupErr } = await supabase
    .from('renewal_orders')
    .select('id, booking_id, extend_minutes, status')
    .eq('id', outTradeNo)
    .maybeSingle()

  if (renewalLookupErr) {
    // Graceful degradation: if the renewal_orders table doesn't exist yet
    // (migration not applied), log at info level instead of error.
    // 42P01 = Postgres undefined_table; PGRST205 = PostgREST "not in schema cache".
    const lookupCode = (renewalLookupErr as { code?: string }).code
    const isMissingTable = lookupCode === '42P01' || lookupCode === 'PGRST205'
    const log = isMissingTable ? console.info : console.error
    log('[webhook/kpay] renewal_order_lookup_failed', { outTradeNo, code: (renewalLookupErr as { code?: string }).code, message: renewalLookupErr.message })
    // Non-fatal — fall through to ordinary booking path.
  }

  if (renewalOrder) {
    // This outTradeNo is a renewal order, not a booking.
    try {
      if (isSuccess) {
        // Idempotent: only update if still pending.
        const { error: paidErr } = await supabase
          .from('renewal_orders')
          .update({ status: 'paid', paid_at: new Date().toISOString() })
          .eq('id', renewalOrder.id)
          .eq('status', 'pending')
        if (paidErr) throw new Error(`renewal mark paid failed: ${paidErr.message}`)

        // Extend booking end_time.
        const { data: bookingRow, error: bErr } = await supabase
          .from('bookings')
          .select('id, end_time')
          .eq('id', renewalOrder.booking_id)
          .single()
        if (bErr || !bookingRow) throw new Error(`renewal booking lookup failed: ${bErr?.message}`)
        // Compute new end_time by adding extend_minutes to existing end_time.
        const [h, m, s] = bookingRow.end_time.split(':').map(Number)
        const totalMinutes = h * 60 + m + renewalOrder.extend_minutes
        const newH = Math.floor(totalMinutes / 60) % 24
        const newM = totalMinutes % 60
        const newEndTime = `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}:${String(s ?? 0).padStart(2, '0')}`
        const { error: updErr } = await supabase
          .from('bookings')
          .update({ end_time: newEndTime })
          .eq('id', renewalOrder.booking_id)
        if (updErr) throw new Error(`renewal booking extend failed: ${updErr.message}`)
      } else if (isFailed) {
        await supabase
          .from('renewal_orders')
          .update({ status: 'failed' })
          .eq('id', renewalOrder.id)
          .eq('status', 'pending')
      } else if (isRefunded) {
        await supabase
          .from('renewal_orders')
          .update({ status: 'cancelled' })
          .eq('id', renewalOrder.id)
      }

      await markWebhookProcessed(supabase, eventId)
      console.log('[webhook/kpay] renewal_processed', { renewalOrderId: renewalOrder.id, result })
    } catch (err) {
      const msg = (err as Error).message
      console.error('[webhook/kpay] renewal_handler_error', { renewalOrderId: renewalOrder.id, message: msg })
      await markWebhookFailed(supabase, eventId, msg)
      await logSiteError('webhooks/kpay', 'error', 'renewal handler failed', {
        message: msg,
        renewalOrderId: renewalOrder.id,
        eventId,
      })
    }
    return new NextResponse('OK', { status: 200 })
  }

  // ── Look up booking by outTradeNo (human_code) ─────────────────────────
  let { data: booking, error: bookingErr } = await supabase
    .from('bookings')
    .select('id, user_id, order_group_id, slot_id, human_code, total_price, payment_method')
    .eq('human_code', outTradeNo)
    .maybeSingle()

  // Admin KPay retries on one booking send `<human_code>-A<n>` (KPay rejects a
  // reused outTradeNo). Fall back to the base code only when the exact lookup
  // found nothing, so every existing outTradeNo resolves exactly as before.
  if (!booking && !bookingErr) {
    const retryMatch = /^(SPACE8-[A-Z0-9]{5}-[A-Z0-9])-A[0-9A-Z]+$/.exec(outTradeNo)
    if (retryMatch) {
      const retry = await supabase
        .from('bookings')
        .select('id, user_id, order_group_id, slot_id, human_code, total_price, payment_method')
        .eq('human_code', retryMatch[1])
        .maybeSingle()
      booking = retry.data
      bookingErr = retry.error
    }
  }

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

  // New behaviour (park late payments, verify stale deliveries, honour KPay "closed")
  // is effective only for admin accounts until PAYMENT_FREEZE_PUBLIC=true.
  const freeze = await isPaymentFreezeActive(booking.user_id)
  if (staleDelivery && !freeze) {
    return new NextResponse('Webhook timestamp too old', { status: 401 })
  }

  try {
    if (isSuccess) {
      if (!booking.payment_method) {
        const message = 'successful KPay webhook has no persisted payment_method'
        console.error('[webhook/kpay] payment_method_missing', {
          bookingId: booking.id,
          outTradeNo,
          orderNo,
          eventId,
        })
        await markWebhookFailed(supabase, eventId, message)
        await logSiteError('webhooks/kpay', 'error', message, {
          bookingId: booking.id,
          outTradeNo,
          orderNo,
          eventId,
        })
        // A later delivery can retry the failed event after the booking row has
        // been reconciled. Never confirm under a guessed method.
        return new NextResponse('Payment method missing', { status: 500 })
      }
      // The amount KPay says was paid must equal what we asked for. A grouped
      // order is charged as ONE order, so compare against the whole group.
      const paidAmount = Number(payload.payAmount)
      if (payload.payAmount === undefined || payload.payAmount === null || Number.isNaN(paidAmount)) {
        console.warn('[webhook/kpay] payAmount_missing', { orderNo, outTradeNo })
      } else {
        let expected = Number(booking.total_price)
        if (booking.order_group_id) {
          const { data: groupRows, error: groupErr } = await supabase
            .from('bookings')
            .select('total_price')
            .eq('order_group_id', booking.order_group_id)
          if (groupErr) throw new Error(`group total lookup failed: ${groupErr.message}`)
          expected = (groupRows ?? []).reduce((sum, r) => sum + Number(r.total_price), 0)
        }
        const currency = String(payload.payCurrency ?? 'HKD')
        if (currency !== 'HKD' || Math.abs(paidAmount - expected) > 0.009) {
          const message = `paid amount mismatch: KPay ${paidAmount} ${currency} vs expected HKD ${expected}`
          console.error('[webhook/kpay] amount_mismatch', { orderNo, outTradeNo, paidAmount, currency, expected })
          await markWebhookFailed(supabase, eventId, message)
          await logSiteError('webhooks/kpay', 'error', message, { orderNo, outTradeNo, eventId })
          await logPaymentEvent({
            bookingId: booking.id,
            orderGroupId: booking.order_group_id,
            providerOrderNo: orderNo,
            event: 'amount_mismatch',
            source: 'webhook',
            reason: message,
          })
          // 200 so KPay stops retrying; the booking stays unconfirmed for manual review.
          return new NextResponse('OK', { status: 200 })
        }
      }
      // A second KPay order of the SAME booking was paid after the booking was already
      // confirmed by a different order (e.g. the customer paid a QR code that was still
      // open after switching method). That is a duplicate charge: nothing is moved here,
      // an admin is alerted to refund it by hand.
      const { data: current } = await supabase
        .from('bookings')
        .select('status, stripe_payment_intent')
        .eq('id', booking.id)
        .maybeSingle()
      if (current?.status === 'confirmed' && current.stripe_payment_intent && current.stripe_payment_intent !== orderNo) {
        await logPaymentEvent({
          bookingId: booking.id,
          orderGroupId: booking.order_group_id,
          providerOrderNo: orderNo,
          event: 'duplicate_payment',
          source: 'webhook',
          reason: `booking already confirmed by order ${current.stripe_payment_intent}`,
          meta: { amount: paidAmount },
        })
        await logSiteError('payments/duplicate', 'error', 'Duplicate KPay payment on an already confirmed booking: refund manually', {
          bookingId: booking.id,
          outTradeNo,
          paidOrderNo: orderNo,
          confirmedOrderNo: current.stripe_payment_intent,
          amount: paidAmount,
        })
        await markWebhookProcessed(supabase, eventId)
        return new NextResponse('OK', { status: 200 })
      }
      if (staleDelivery && (await getLiveKPayState(orderNo)) !== 'paid') {
        console.error('[webhook/kpay] stale_success_not_verified', { orderNo, outTradeNo })
        await markWebhookFailed(supabase, eventId, 'stale success webhook not confirmed by KPay query')
        return new NextResponse('Webhook timestamp too old', { status: 401 })
      }
      try {
        await handleSucceeded(supabase, booking, orderNo, outTradeNo, eventId)
        await logPaymentEvent({
          bookingId: booking.id,
          orderGroupId: booking.order_group_id,
          providerOrderNo: orderNo,
          event: 'webhook_paid_confirmed',
          source: 'webhook',
          toState: 'confirmed',
        })
      } catch (confirmErr) {
        // Money arrived but the booking cannot be confirmed (already cancelled /
        // expired / failed, or the slot was taken). NEVER move money automatically:
        // park the order as payment_review and alert an admin to handle it by hand.
        const message = confirmErr instanceof Error ? confirmErr.message : String(confirmErr)
        const needsReview = message.includes('booking_not_confirmable') || message.includes('slot_conflict_payment_review')
        if (!needsReview || !freeze) throw confirmErr
        await parkPaidBookingForReview({
          bookingId: booking.id,
          orderGroupId: booking.order_group_id,
          providerOrderNo: orderNo,
          source: 'webhook',
          reason: message,
          amount: paidAmount,
        })
        await markWebhookProcessed(supabase, eventId)
      }
    } else if (isFailed && (!closedByState || freeze)) {
      await handleFailed(supabase, booking, eventId)
      await logPaymentEvent({
        bookingId: booking.id,
        orderGroupId: booking.order_group_id,
        providerOrderNo: orderNo,
        event: 'webhook_closed_or_failed',
        source: 'webhook',
        reason: `result=${result}`,
      })
    } else if (isRefunded) {
      await handleRefunded(supabase, booking, orderNo, eventId)
    } else {
      // Other statuses (pending, etc.) — just mark processed
      await markWebhookProcessed(supabase, eventId)
    }

    console.log('[webhook/kpay] success', { eventId, orderNo, result })
    return new NextResponse('OK', { status: 200 })
  } catch (err) {
    const msg = (err as Error).message
    console.error('[webhook/kpay] handler_error', {
      eventId,
      orderNo,
      result,
      message: msg,
      stack: (err as Error).stack,
    })
    await markWebhookFailed(supabase, eventId, msg)
    await logSiteError('webhooks/kpay', 'error', `${eventType} handler failed`, {
      message: msg,
      eventId,
      orderNo,
      result,
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
  eventId: string,
) {
  // The rail is persisted by checkout/create before the order reaches KPay, and
  // KPay's callback does not carry it. Defaulting to 'fps' here would silently
  // mislabel every Alipay/PayMe/Octopus booking, so a missing value raises instead.
  // The caller marks the event failed and writes to site_errors — it does NOT
  // auto-retry (that handler returns 200), so this needs manual reconciliation.
  // Only pre-existing pending rows created before the method was persisted can
  // reach this branch.
  const paymentMethod = booking.payment_method
  if (!paymentMethod) {
    throw new Error(
      `booking ${booking.id} has no persisted payment_method; refusing to guess a rail`,
    )
  }

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

    // Mark payment attempt succeeded (non-fatal).
    await supabase.rpc('complete_payment_attempt', {
      p_provider_order_no: providerOrderNo,
      p_provider: 'kpay',
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

  // Mark payment attempt succeeded (non-fatal).
  await supabase.rpc('complete_payment_attempt', {
    p_provider_order_no: providerOrderNo,
    p_provider: 'kpay',
  })
}

async function handleFailed(
  supabase: SupabaseClient,
  booking: BookingSummary,
  eventId: string,
) {
  if (booking.order_group_id) {
    console.log('[webhook/kpay] group payment failed, marking bookings failed', {
      orderGroupId: booking.order_group_id,
    })
    const { data, error } = await supabase.rpc('mark_kpay_payment_failed', {
      p_booking_id: booking.id,
      p_event_id: eventId,
    })
    if (error) throw new Error(`mark_kpay_payment_failed failed: ${error.message}`)
    assertRpcSucceeded(data, 'mark_kpay_payment_failed')
    return
  }

  console.log('[webhook/kpay] payment failed, marking booking failed', {
    bookingId: booking.id,
  })
  const { data, error } = await supabase.rpc('mark_kpay_payment_failed', {
    p_booking_id: booking.id,
    p_event_id: eventId,
  })
  if (error) throw new Error(`mark_kpay_payment_failed failed: ${error.message}`)
  assertRpcSucceeded(data, 'mark_kpay_payment_failed')
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