import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceSupabase } from '@/lib/supabase/service'
import { getPaymentProvider } from '@/lib/payments'
import { KPayProvider } from '@/lib/payments/kpay'
import { isUatEnv } from '@/lib/env/uat'
import { humanReadableCode } from '@/lib/qr/jwt'
import { checkAmountMatch, logAmountMismatch } from '@/lib/payments/reconciliation'
import { getLiveKPayState } from '@/lib/payments/live-order'
import { isPaymentFreezeActive } from '@/lib/payments/freeze-flag'
import { parkPaidBookingForReview } from '@/lib/payments/park-for-review'
import { logSiteError } from '@/lib/errors/log'
import { logPaymentEvent } from '@/lib/payments/payment-events'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/checkout/status?bookingId=...
// Returns the payment order status for a booking. Used by the UI to poll while
// waiting for the customer to complete payment (QR scan / H5 redirect).
//
// IMPORTANT: Routes to KPay or Stripe logic based on booking.payment_provider.
//
// For grouped bookings, the primary bookingId is sufficient — all siblings
// share the same provider_order_no.
export async function GET(req: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const bookingId = new URL(req.url).searchParams.get('bookingId')
    if (!bookingId) {
      return NextResponse.json({ error: 'Missing bookingId' }, { status: 400 })
    }

    const service = getServiceSupabase()

    const { data: booking, error: bookingErr } = await service
      .from('bookings')
      .select('id, status, payment_provider, provider_order_no, payment_method, order_group_id, human_code, total_price, user_id')
      .eq('id', bookingId)
      .eq('user_id', user.id)
      .single()

    if (bookingErr || !booking) {
      console.log('[checkout/status] booking_not_found', { bookingId, userId: user.id })
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    // Route to provider-specific handler based on payment_provider
    // A KPay order number is all digits; a Stripe id is `pi_…`. The public Stripe
    // flow can overwrite payment_provider on a pending row that already holds a
    // KPay order, and polling that row against Stripe never confirms a paid
    // order. The order number is the more reliable signal.
    const kpayOrderNo =
      typeof booking.provider_order_no === 'string' && /^\d{12,}$/.test(booking.provider_order_no)
    const provider =
      booking.payment_provider === 'stripe' && kpayOrderNo ? 'kpay' : booking.payment_provider

    // Free booking path (no payment required) — when a promo code or discount fully
    // covers the order, payment_provider is null and the booking was already confirmed
    // immediately via /api/booking/free-confirm (no async payment to poll)
    // Only a booking that is really confirmed counts as free. A pending / failed /
    // cancelled row with no provider yet (e.g. right after "pay again" cleared the
    // provider) must NOT be reported as confirmed — it falls through to the KPay
    // handler below, which reports its true state and hold.
    const noProvider = provider === null || provider === 'free' || provider === 'none'
    if (noProvider && booking.status === 'confirmed') {
      console.log('[checkout/status] free_booking', { bookingId, status: booking.status })
      return NextResponse.json({
        bookingId: booking.id,
        status: 'confirmed',
        providerStatus: 'free',
        totalPrice: Number(booking.total_price),
      })
    }

    // PaymentX (hosted cashier) bookings are settled by /api/paymentx/status and its
    // webhook; this route only lets the shared confirmation screen see the outcome.
    if (provider === 'paymentx') {
      return NextResponse.json({
        bookingId: booking.id,
        status: booking.status === 'confirmed' ? 'confirmed' : 'pending',
        providerStatus: booking.status === 'confirmed' ? 'paymentx' : 'pending',
        totalPrice: Number(booking.total_price),
      })
    }

    if (noProvider) {
      return handleKPayStatus(booking, service, user.id, new URL(req.url).hostname)
    } else if (provider === 'stripe') {
      return handleStripeStatus(booking, service, user.id)
    } else if (provider === 'kpay') {
      return handleKPayStatus(booking, service, user.id, new URL(req.url).hostname)
    } else {
      console.error('[checkout/status] unknown payment_provider', { provider, bookingId })
      return NextResponse.json(
        { error: 'unsupported_provider', detail: `Payment provider "${provider}" is not supported` },
        { status: 400 }
      )
    }
  } catch (err) {
    const e = err as Error
    console.error('[checkout/status] error', { message: e.message, stack: e.stack })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// ──────────────────────────────────────────────────────────────────
// Stripe Status Handler
// ──────────────────────────────────────────────────────────────────

async function handleStripeStatus(booking: any, service: any, userId: string) {
  const startedAt = Date.now()
  const logResult = (payload: Record<string, unknown>) => {
    console.log('[Stripe] pollResult', { bookingId: booking.id, elapsedMs: Date.now() - startedAt, ...payload })
  }

  // Re-query booking status to avoid stale data from the initial query. The webhook
  // may have written `status = 'confirmed'` between the outer query (line 37) and
  // this handler, and we must see that update immediately — not after a minute of
  // retries. This query hits the same service_role client as the webhook, bypassing
  // read replica lag.
  const { data: freshBooking, error: freshErr } = await service
    .from('bookings')
    .select('id, status, payment_provider, provider_order_no, payment_method, order_group_id, human_code, total_price, user_id')
    .eq('id', booking.id)
    .single()

  if (freshErr || !freshBooking) {
    console.error('[Stripe] pollResult fresh_query_failed', { bookingId: booking.id, error: freshErr?.message })
    // Fallback to stale booking if re-query fails
  } else {
    booking = freshBooking
  }

  const holdState = async (): Promise<{ holdActive: boolean; holdExpiresAt: string | null }> => {
    const { data, error } = await service.rpc('checkout_hold_expiry', {
      p_booking_id: booking.id,
      p_user_id: userId,
    })
    if (error || !data || typeof data !== 'object' || Array.isArray(data)) {
      if (error) console.error('[Stripe] pollResult hold_expiry_failed', { message: error.message })
      return { holdActive: false, holdExpiresAt: null }
    }
    const record = data as Record<string, unknown>
    return {
      holdActive: record.hold_active === true,
      holdExpiresAt: typeof record.expires_at === 'string' ? record.expires_at : null,
    }
  }

  // If the booking is already confirmed server-side (webhook fired), short-circuit
  if (booking.status === 'confirmed') {
    logResult({ status: 'confirmed', providerStatus: 'success' })
    return NextResponse.json({
      bookingId: booking.id,
      status: 'confirmed',
      providerStatus: 'success',
      totalPrice: Number(booking.total_price),
    })
  }

  if (booking.status === 'cancelled' || booking.status === 'expired') {
    logResult({ status: booking.status, providerStatus: booking.status })
    return NextResponse.json({
      bookingId: booking.id,
      status: booking.status,
      providerStatus: booking.status === 'cancelled' ? 'cancelled' : booking.status,
      holdActive: false,
      holdExpiresAt: null,
    })
  }

  if (booking.status === 'payment_failed') {
    const hold = await holdState()
    logResult({ status: booking.status, providerStatus: booking.status, holdActive: hold.holdActive })
    return NextResponse.json({
      bookingId: booking.id,
      status: booking.status,
      providerStatus: booking.status,
      holdActive: hold.holdActive,
      holdExpiresAt: hold.holdExpiresAt,
    })
  }

  // The charge succeeded but its amount disagreed with total_price, so the
  // webhook parked the row instead of confirming. Terminal for the UI: polling
  // cannot resolve it, only a manual refund reconciliation can.
  if (booking.status === 'payment_review') {
    logResult({ status: booking.status, providerStatus: 'amount_mismatch' })
    return NextResponse.json({
      bookingId: booking.id,
      status: 'payment_review',
      providerStatus: 'amount_mismatch',
      holdActive: false,
      holdExpiresAt: null,
    })
  }

  const hold = await holdState()

  // No provider order yet — the order hasn't been created
  if (!booking.provider_order_no) {
    logResult({ status: booking.status === 'pending' ? 'pending' : 'failed', providerStatus: 'pending', holdActive: hold.holdActive })
    return NextResponse.json({
      bookingId: booking.id,
      status: booking.status === 'pending' ? 'pending' : 'failed',
      providerStatus: 'pending',
      holdActive: hold.holdActive,
      holdExpiresAt: hold.holdExpiresAt,
    })
  }

  // Query Stripe for current PaymentIntent status
  const provider = getPaymentProvider()
  const orderStatus = await provider.queryOrder(booking.provider_order_no)

  // Proactive confirmation: if provider reports success but DB isn't confirmed yet,
  // confirm immediately rather than waiting for the webhook (which may be delayed
  // or lost). This is the critical fallback that prevents stuck-pending scenarios.
  let uiStatus: string
  switch (orderStatus.status) {
    case 'success':
      if (booking.status !== 'confirmed') {
        // Amount reconciliation at polling stage: before confirming, verify that
        // the amount Stripe captured matches the booking's required total. This
        // catches webhook-bypass scenarios where the proactive path is the only
        // confirmation attempt.
        try {
          const stripe = await import('@/lib/stripe/server').then(m => m.getStripe())
          const stripeIntent = await stripe.paymentIntents.retrieve(booking.provider_order_no)
          const amountCheck = checkAmountMatch(Number(booking.total_price), stripeIntent.amount)

          if (!amountCheck.matches) {
            logAmountMismatch('polling', {
              bookingId: booking.id,
              providerOrderNo: booking.provider_order_no,
              userId: booking.user_id,
              requiredCents: amountCheck.requiredCents,
              actualCents: amountCheck.actualCents,
              scenario: amountCheck.scenario!,
              discrepancyCents: amountCheck.discrepancyCents!,
            })

            if (amountCheck.scenario === 'underpaid') {
              // Underpaid: park in payment_review, return contact-support message
              await service
                .from('bookings')
                .update({ status: 'payment_review' })
                .eq('id', booking.id)
              logResult({ status: 'payment_review', providerStatus: 'amount_mismatch_underpaid' })
              return NextResponse.json({
                bookingId: booking.id,
                status: 'payment_review',
                providerStatus: 'amount_mismatch_underpaid',
                holdActive: false,
                holdExpiresAt: null,
              })
            } else if (amountCheck.scenario === 'overpaid') {
              // Overpaid: confirm booking but log prominently for support follow-up
              console.warn('[Stripe] proactive polling: OVERPAID — confirming but flagging', {
                bookingId: booking.id,
                chargedCents: amountCheck.actualCents,
                requiredCents: amountCheck.requiredCents,
                excessCents: amountCheck.discrepancyCents!,
              })
              // Continue to confirmation below
            }
          }
        } catch (amountCheckErr) {
          // If amount check fails (e.g., Stripe API error), FAIL-CLOSED: do not confirm
          console.error('[Stripe] proactive polling: amount check failed — FAILING CLOSED', {
            bookingId: booking.id,
            error: (amountCheckErr as Error).message,
          })
          // Park in payment_review until support reconciles
          await service
            .from('bookings')
            .update({ status: 'payment_review' })
            .eq('id', booking.id)
          logResult({ status: 'payment_review', providerStatus: 'amount_check_error' })
          return NextResponse.json({
            bookingId: booking.id,
            status: 'payment_review',
            providerStatus: 'amount_check_error',
            holdActive: false,
            holdExpiresAt: null,
          })
        }

        try {
          if (booking.order_group_id) {
            const { data: rows, error: rowsErr } = await service
              .from('bookings')
              .select('id, total_price')
              .eq('order_group_id', booking.order_group_id)

            if (!rowsErr && rows && rows.length > 0) {
              const qrCodes: Record<string, string> = {}
              for (const r of rows) {
                qrCodes[r.id] = humanReadableCode(r.id)
              }
              console.log('[Stripe] proactive confirm_booking_group', {
                orderGroupId: booking.order_group_id,
                bookings: rows.length,
                providerOrderNo: booking.provider_order_no,
              })
              await service.rpc('confirm_booking_group', {
                p_order_group_id: booking.order_group_id,
                p_payment_intent_id: booking.provider_order_no,
                p_payment_method: booking.payment_method,
                p_qr_codes: qrCodes,
                p_event_id: null,
              })
            }
          } else {
            const humanCode = booking.human_code ?? humanReadableCode(booking.id)
            console.log('[Stripe] proactive confirm_booking', {
              bookingId: booking.id,
              providerOrderNo: booking.provider_order_no,
            })
            await service.rpc('confirm_booking', {
              p_booking_id: booking.id,
              p_payment_intent_id: booking.provider_order_no,
              p_payment_method: booking.payment_method,
              p_qr_code: humanCode,
              p_event_id: null,
            })
          }
          const { data: refreshed } = await service
            .from('bookings')
            .select('status')
            .eq('id', booking.id)
            .single()
          if (refreshed?.status === 'confirmed') {
            try {
              const { sendBookingConfirmation } = await import('@/lib/resend/template-send')
              await sendBookingConfirmation(booking.id)
              await service.from('notification_log').insert([
                { user_id: booking.user_id, booking_id: booking.id, channel: 'email', type: 'booking_confirmed', status: 'sent' },
                { user_id: booking.user_id, booking_id: booking.id, channel: 'whatsapp', type: 'booking_confirmed', status: 'pending' },
              ])
            } catch (e) {
              console.error('[Stripe] proactive confirmation notification_failed', {
                bookingId: booking.id,
                message: (e as Error).message,
              })
            }
            try {
              await service.rpc('complete_payment_attempt', {
                p_provider_order_no: booking.provider_order_no,
                p_provider: 'stripe',
              })
            } catch {
              // non-fatal
            }
            logResult({ status: 'confirmed', providerStatus: 'success' })
            return NextResponse.json({
              bookingId: booking.id,
              status: 'confirmed',
              providerStatus: 'success',
              totalPrice: Number(booking.total_price),
            })
          }
        } catch (e) {
          console.error('[Stripe] proactive confirmation failed', {
            bookingId: booking.id,
            error: (e as Error).message,
          })
        }
      }
      uiStatus = 'pending_confirmation'
      break
    case 'failed':
      uiStatus = 'failed'
      break
    case 'cancelled':
      uiStatus = 'cancelled'
      break
    case 'closed':
      uiStatus = 'failed'
      break
    case 'refunded':
      uiStatus = 'refunded'
      break
    default:
      uiStatus = 'pending'
  }

  logResult({ status: uiStatus, providerStatus: orderStatus.status })

  return NextResponse.json({
    bookingId: booking.id,
    status: uiStatus,
    providerStatus: orderStatus.status,
    holdActive: hold.holdActive,
    holdExpiresAt: hold.holdExpiresAt,
    rawStatus: orderStatus.rawStatus,
    ...(orderStatus.failureCode ? { failureCode: orderStatus.failureCode } : {}),
    ...(orderStatus.failureReason ? { failureReason: orderStatus.failureReason } : {}),
  })
}

// ──────────────────────────────────────────────────────────────────
// KPay Status Handler
// ──────────────────────────────────────────────────────────────────

/** A Supabase rpc() call that failed without throwing: its error, or a { success: false } result. */
function rpcFailure(res: { data: unknown; error: { message: string } | null }): string | null {
  if (res.error) return res.error.message.slice(0, 200)
  const d = res.data
  if (d && typeof d === 'object' && !Array.isArray(d) && (d as Record<string, unknown>).success === false) {
    const reason = (d as Record<string, unknown>).reason
    return typeof reason === 'string' ? reason.slice(0, 200) : 'confirm rejected'
  }
  return null
}

async function handleKPayStatus(booking: any, service: any, userId: string, hostname: string) {
  const startedAt = Date.now()
  const logResult = (payload: Record<string, unknown>) => {
    console.log('[KPay] pollResult', { bookingId: booking.id, elapsedMs: Date.now() - startedAt, ...payload })
  }

  // Reference + state code shown on the payment / confirm pages so a customer and
  // support can quote the exact situation. Contains no secrets.
  const ref = {
    code: typeof booking.human_code === 'string' ? booking.human_code : null,
    orderTail: typeof booking.provider_order_no === 'string' ? booking.provider_order_no.slice(-6) : null,
  }
  const freeze = await isPaymentFreezeActive(userId)
  const reply = (stateCode: string, payload: Record<string, unknown>) =>
    NextResponse.json({ ...payload, freeze, ref, stateCode, checkedAt: new Date().toISOString() })

  const holdState = async (): Promise<{ holdActive: boolean; holdExpiresAt: string | null }> => {
    const { data, error } = await service.rpc('checkout_hold_expiry', {
      p_booking_id: booking.id,
      p_user_id: userId,
    })
    if (error || !data || typeof data !== 'object' || Array.isArray(data)) {
      if (error) console.error('[KPay] pollResult hold_expiry_failed', { message: error.message })
      return { holdActive: false, holdExpiresAt: null }
    }
    const record = data as Record<string, unknown>
    return {
      holdActive: record.hold_active === true,
      holdExpiresAt: typeof record.expires_at === 'string' ? record.expires_at : null,
    }
  }

  if (booking.status === 'confirmed') {
    logResult({ status: 'confirmed', providerStatus: 'success' })
    return reply('CONFIRMED', {
      bookingId: booking.id,
      status: 'confirmed',
      providerStatus: 'success',
      totalPrice: Number(booking.total_price),
    })
  }

  // Paid, but the booking could not be confirmed. A person handles it; nothing here
  // retries or moves money.
  if (booking.status === 'payment_review') {
    logResult({ status: 'payment_review', providerStatus: 'success' })
    return reply('PAID_NEEDS_REVIEW', {
      bookingId: booking.id,
      status: 'payment_review',
      providerStatus: 'success',
      holdActive: false,
      holdExpiresAt: null,
    })
  }

  // A released booking may still own a payable (or already paid) KPay order. The
  // database state alone must never be reported as "payment failed" in that case.
  if (freeze && (booking.status === 'cancelled' || booking.status === 'expired')) {
    const live = await getLiveKPayState(booking.provider_order_no, hostname)
    // Paid on a released booking: fall through. The proactive confirm below re-activates
    // the booking (the database re-applies credit / promo) whenever the slot is still free.
    if (live !== 'paid') {
    logResult({ status: booking.status, providerStatus: booking.status, live })
    return reply(live === 'pending' || live === 'unknown' ? 'RELEASED_KPAY_STILL_OPEN' : 'RELEASED', {
      bookingId: booking.id,
      status: booking.status,
      providerStatus: booking.status === 'cancelled' ? 'cancelled' : booking.status,
      kpayState: live,
      holdActive: false,
      holdExpiresAt: null,
    })
    }
  }

  if (!freeze && (booking.status === 'cancelled' || booking.status === 'expired')) {
    logResult({ status: booking.status, providerStatus: booking.status })
    return reply('RELEASED', {
      bookingId: booking.id,
      status: booking.status,
      providerStatus: booking.status === 'cancelled' ? 'cancelled' : booking.status,
      holdActive: false,
      holdExpiresAt: null,
    })
  }

  // payment_failed with no KPay order really did fail. With an order, fall through
  // and ask KPay: the sweep may have marked it failed while the order is payable.
  if (booking.status === 'payment_failed' && (!freeze || !booking.provider_order_no)) {
    const hold = await holdState()
    logResult({ status: booking.status, providerStatus: booking.status, holdActive: hold.holdActive })
    return reply('FAILED_NO_ORDER', {
      bookingId: booking.id,
      status: booking.status,
      providerStatus: booking.status,
      holdActive: hold.holdActive,
      holdExpiresAt: hold.holdExpiresAt,
    })
  }

  const hold = await holdState()

  if (!booking.provider_order_no) {
    logResult({ status: booking.status === 'pending' ? 'pending' : 'failed', providerStatus: 'pending', holdActive: hold.holdActive })
    return reply('WAIT_NO_ORDER_YET', {
      bookingId: booking.id,
      status: booking.status === 'pending' ? 'pending' : 'failed',
      providerStatus: 'pending',
      holdActive: hold.holdActive,
      holdExpiresAt: hold.holdExpiresAt,
    })
  }

  // A KPay booking must be queried through KPay. getPaymentProvider() follows the
  // site-wide PAYMENT_PROVIDER env (stripe), which sent KPay order numbers to
  // Stripe ("No such payment_intent") and left admin KPay bookings unpollable.
  // UAT hosts use the KPay UAT environment; every other host is production.
  const provider = isUatEnv(hostname)
    ? new KPayProvider(hostname)
    : new KPayProvider(undefined, 'prod')
  let orderStatus: Awaited<ReturnType<typeof provider.queryOrder>>
  try {
    orderStatus = await provider.queryOrder(booking.provider_order_no)
  } catch (e) {
    // Lookup failed: say so honestly. Never report a failure we have not seen.
    console.warn('[KPay] pollResult lookup_failed', { bookingId: booking.id, message: (e as Error).message })
    return reply('LOOKUP_ERROR', {
      bookingId: booking.id,
      status: 'pending',
      providerStatus: 'pending',
      holdActive: hold.holdActive,
      holdExpiresAt: hold.holdExpiresAt,
    })
  }

  let uiStatus: string
  switch (orderStatus.status) {
    case 'success':
      if (booking.status !== 'confirmed') {
        let confirmFailure: string | null = null
        // Note: KPay's queryOrder does not return the captured amount, so we cannot
        // perform amount reconciliation here. The webhook's amount check is the primary
        // safeguard. Confirm the booking if KPay reports success.
        try {
          if (booking.order_group_id) {
            const { data: rows, error: rowsErr } = await service
              .from('bookings')
              .select('id, total_price')
              .eq('order_group_id', booking.order_group_id)

            if (!rowsErr && rows && rows.length > 0) {
              const qrCodes: Record<string, string> = {}
              for (const r of rows) {
                qrCodes[r.id] = humanReadableCode(r.id)
              }
              console.log('[KPay] proactive confirm_booking_group', {
                orderGroupId: booking.order_group_id,
                bookings: rows.length,
                providerOrderNo: booking.provider_order_no,
              })
              const groupConfirm = await service.rpc('confirm_booking_group', {
                p_order_group_id: booking.order_group_id,
                p_payment_intent_id: booking.provider_order_no,
                p_payment_method: booking.payment_method,
                p_qr_codes: qrCodes,
                p_event_id: null,
              })
              confirmFailure = rpcFailure(groupConfirm)
            }
          } else {
            const humanCode = booking.human_code ?? humanReadableCode(booking.id)
            console.log('[KPay] proactive confirm_booking', {
              bookingId: booking.id,
              providerOrderNo: booking.provider_order_no,
            })
            const singleConfirm = await service.rpc('confirm_booking', {
              p_booking_id: booking.id,
              p_payment_intent_id: booking.provider_order_no,
              p_payment_method: booking.payment_method,
              p_qr_code: humanCode,
              p_event_id: null,
            })
            confirmFailure = rpcFailure(singleConfirm)
          }
          const { data: refreshed } = await service
            .from('bookings')
            .select('status')
            .eq('id', booking.id)
            .single()
          if (refreshed?.status !== 'confirmed' && confirmFailure) {
            // KPay says PAID but the database refused to confirm. Without this the customer sits on
            // "confirming" forever and nobody is told. The alert email goes out from logSiteError.
            // The page polls every few seconds: log once per booking per 10 minutes.
            const { count: already } = await service
              .from('site_error_log')
              .select('id', { count: 'exact', head: true })
              .eq('source', 'checkout/status')
              .eq('message', 'KPay paid but booking could not be confirmed')
              .contains('detail', { bookingId: booking.id })
              .gte('created_at', new Date(Date.now() - 10 * 60_000).toISOString())
            if (!already) {
              await logSiteError('checkout/status', 'error', 'KPay paid but booking could not be confirmed', {
                bookingId: booking.id,
                providerOrderNo: booking.provider_order_no,
                bookingStatus: refreshed?.status ?? booking.status,
                message: confirmFailure,
              })
            }
          }
          if (refreshed?.status === 'confirmed') {
            try {
              const { sendBookingConfirmation } = await import('@/lib/resend/template-send')
              await sendBookingConfirmation(booking.id)
              await service.from('notification_log').insert([
                { user_id: booking.user_id, booking_id: booking.id, channel: 'email', type: 'booking_confirmed', status: 'sent' },
                { user_id: booking.user_id, booking_id: booking.id, channel: 'whatsapp', type: 'booking_confirmed', status: 'pending' },
              ])
            } catch (e) {
              console.error('[KPay] proactive confirmation notification_failed', {
                bookingId: booking.id,
                message: (e as Error).message,
              })
            }
            try {
              await service.rpc('complete_payment_attempt', {
                p_provider_order_no: booking.provider_order_no,
                p_provider: 'kpay',
              })
            } catch {
              // non-fatal
            }
            logResult({ status: 'confirmed', providerStatus: 'success' })
            await logPaymentEvent({
              bookingId: booking.id,
              orderGroupId: booking.order_group_id ?? null,
              providerOrderNo: booking.provider_order_no,
              event: 'status_poll_confirmed',
              source: 'status_poll',
              fromState: booking.status,
              toState: 'confirmed',
            })
            return reply('CONFIRMED', {
              bookingId: booking.id,
              status: 'confirmed',
              providerStatus: 'success',
              totalPrice: Number(booking.total_price),
            })
          }
        } catch (e) {
          console.error('[KPay] proactive confirmation failed', {
            bookingId: booking.id,
            error: (e as Error).message,
          })
        }
      }
      uiStatus = 'pending_confirmation'
      break
    case 'failed':
      uiStatus = 'failed'
      break
    case 'cancelled':
      uiStatus = 'cancelled'
      break
    case 'closed':
      uiStatus = 'failed'
      break
    case 'refunded':
      uiStatus = 'refunded'
      break
    default:
      uiStatus = 'pending'
  }

  logResult({ status: uiStatus, providerStatus: orderStatus.status })

  // If the proactive confirm was rejected because the booking can no longer be
  // confirmed, it has been parked as payment_review by the database; report that.
  if (uiStatus === 'pending_confirmation') {
    const { data: after } = await service.from('bookings').select('status').eq('id', booking.id).single()
    if (after?.status === 'cancelled' || after?.status === 'expired') {
      // Confirm was refused for a released booking (slot taken, or the database does not
      // re-activate it yet): park for review rather than showing a payment failure.
      await parkPaidBookingForReview({
        bookingId: booking.id,
        orderGroupId: booking.order_group_id ?? null,
        providerOrderNo: booking.provider_order_no,
        source: 'status_poll',
        reason: `paid_after_${after.status}`,
      })
      return reply('PAID_NEEDS_REVIEW', {
        bookingId: booking.id,
        status: 'payment_review',
        providerStatus: 'success',
        holdActive: false,
        holdExpiresAt: null,
      })
    }
    if (after?.status === 'payment_review') {
      return reply('PAID_NEEDS_REVIEW', {
        bookingId: booking.id,
        status: 'payment_review',
        providerStatus: 'success',
        holdActive: false,
        holdExpiresAt: null,
      })
    }
  }

  const stateCode =
    uiStatus === 'pending_confirmation' ? 'KPAY_PAID_WAIT_CONFIRM' :
      uiStatus === 'pending' ? 'WAIT_KPAY_OPEN' :
        orderStatus.status === 'closed' ? 'KPAY_CLOSED' :
          orderStatus.status === 'refunded' ? 'KPAY_REFUNDED' : 'KPAY_FAILED'

  return reply(stateCode, {
    bookingId: booking.id,
    status: uiStatus,
    providerStatus: orderStatus.status,
    holdActive: hold.holdActive,
    holdExpiresAt: hold.holdExpiresAt,
    rawStatus: orderStatus.rawStatus,
    ...(orderStatus.failureCode ? { failureCode: orderStatus.failureCode } : {}),
    ...(orderStatus.failureReason ? { failureReason: orderStatus.failureReason } : {}),
  })
}
