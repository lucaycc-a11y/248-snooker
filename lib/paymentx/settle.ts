// ─────────────────────────────────────────────────────────────────
// settlePaymentXOrder — the one place that turns "KPay says this managed order is paid"
// into a confirmed booking. Called from the status poll, the notify route and the admin
// sync button, so the three can never disagree.
//
//   paid    → confirm the booking (same RPCs the live flow uses). If the slot is gone or the
//             RPC refuses, park it as payment_review. NEVER refunds.
//   pending → nothing to do
//   expired / closed → order marked, booking left to the normal sweep
//   unknown → lookup failed; never decide on a failed lookup
// ─────────────────────────────────────────────────────────────────

import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'
import { humanReadableCode } from '@/lib/qr/jwt'
import { logPaymentEvent } from '@/lib/payments/payment-events'
import { parkPaidBookingForReview } from '@/lib/payments/park-for-review'
import { logSiteError } from '@/lib/errors/log'
import { PaymentXClient } from './client'
import { logPaymentXEvent } from './events'

export type PaymentXOrderRow = {
  id: string
  booking_id: string
  order_group_id: string | null
  user_id: string
  managed_out_trade_no: string
  managed_order_no: string | null
  amount: number | string
  status: string
  paid_order_no: string | null
  is_test: boolean
}

export type SettleOutcome =
  | 'confirmed'
  | 'already_confirmed'
  | 'needs_review'
  | 'pending'
  | 'closed'
  | 'unknown'
  | 'not_found'

export type SettleSource = 'status_poll' | 'webhook' | 'admin'

type BookingRow = {
  id: string
  status: string
  human_code: string | null
  order_group_id: string | null
  payment_method: string | null
  total_price: number | string | null
  stripe_payment_intent?: string | null
}

const ORDER_COLUMNS =
  'id, booking_id, order_group_id, user_id, managed_out_trade_no, managed_order_no, amount, status, paid_order_no, is_test'

export async function loadPaymentXOrder(id: string): Promise<PaymentXOrderRow | null> {
  const { data } = await getLegacyServiceSupabase().from('paymentx_orders').select(ORDER_COLUMNS).eq('id', id).maybeSingle()
  return (data as PaymentXOrderRow | null) ?? null
}

export async function settlePaymentXOrder(
  order: PaymentXOrderRow,
  source: SettleSource,
  hostname?: string,
): Promise<SettleOutcome> {
  const db = getLegacyServiceSupabase()

  // Terminal states are final.
  if (order.status === 'paid') return 'already_confirmed'
  if (order.status === 'needs_review') return 'needs_review'
  if (!order.managed_order_no) return order.status === 'creating' ? 'pending' : 'closed'

  let result
  try {
    result = await new PaymentXClient(hostname).queryManagedOrder({ managedOrderNo: order.managed_order_no })
  } catch (e) {
    console.warn('[paymentx/settle] query failed', { orderId: order.id, message: (e as Error).message })
    return 'unknown'
  }

  const now = new Date().toISOString()

  if (result.state === 'pending') return 'pending'

  if (result.state === 'expired' || result.state === 'closed') {
    await db
      .from('paymentx_orders')
      .update({ status: result.state === 'expired' ? 'expired' : 'closed', updated_at: now, completed_at: now })
      .eq('id', order.id)
      .in('status', ['creating', 'pending'])
    await logPaymentEvent({
      bookingId: order.booking_id,
      orderGroupId: order.order_group_id,
      event: 'paymentx_order_closed',
      source: source === 'admin' ? 'admin' : source === 'webhook' ? 'webhook' : 'status_poll',
      reason: result.state,
      providerOrderNo: order.managed_order_no,
    })
    return 'closed'
  }

  if (result.state !== 'paid') return 'unknown'

  // ── Paid ────────────────────────────────────────────────────────
  const paidOrderNo = result.paidOrderNo ?? order.managed_order_no
  const eventSource = source === 'admin' ? 'admin' : source === 'webhook' ? 'webhook' : 'status_poll'

  // One hosted-cashier order can hold several payment orders: more than one success means the
  // customer was charged twice. Nothing is refunded here; every admin is emailed to refund by hand.
  const successes = result.payments.filter((p) => p.result === 2)
  if (successes.length > 1) {
    await logSiteError('payments/duplicate', 'error', 'PaymentX: more than one successful payment on one cashier order: refund manually', {
      bookingId: order.booking_id,
      providerOrderNo: order.managed_order_no,
      paidOrderNo,
      count: successes.length,
    })
  }

  const { data: bookingRow } = await db
    .from('bookings')
    .select('id, status, human_code, order_group_id, payment_method, total_price, stripe_payment_intent')
    .eq('id', order.booking_id)
    .maybeSingle()
  const booking = bookingRow as BookingRow | null
  if (!booking) {
    await logSiteError('payments/review', 'error', 'PaymentX paid but booking not found', {
      providerOrderNo: order.managed_order_no,
      paidOrderNo,
      bookingId: order.booking_id,
    })
    return 'not_found'
  }

  // Sanity: the amount KPay collected must match what we asked for AND, for a single booking,
  // what the booking now costs (the order may predate a wallet / promo change). A mismatch is
  // never auto-confirmed — it goes to a person.
  const expected = Number(order.amount)
  const bookingTotal = !booking.order_group_id && booking.total_price !== null ? Number(booking.total_price) : null
  const mismatch =
    result.payAmount !== null &&
    ((Number.isFinite(expected) && Math.abs(result.payAmount - expected) > 0.009) ||
      (bookingTotal !== null && Number.isFinite(bookingTotal) && Math.abs(result.payAmount - bookingTotal) > 0.009))
  if (mismatch) {
    await db
      .from('paymentx_orders')
      .update({ status: 'needs_review', paid_order_no: paidOrderNo, failure_reason: `amount_mismatch kpay=${result.payAmount} order=${expected} booking=${bookingTotal}`, updated_at: now })
      .eq('id', order.id)
      .in('status', ['creating', 'pending', 'cancelled'])
    await parkPaidBookingForReview({
      bookingId: booking.id,
      orderGroupId: booking.order_group_id,
      providerOrderNo: order.managed_order_no,
      source: eventSource,
      reason: 'paymentx_amount_mismatch',
      amount: result.payAmount,
    })
    await logPaymentXEvent({ kind: 'amount_mismatch', bookingId: order.booking_id, managedOrderNo: order.managed_order_no, note: `kpay=${result.payAmount} order=${expected} booking=${bookingTotal}` })
    return 'needs_review'
  }

  // Booking already confirmed (e.g. an earlier poll won the race) → just close our order.
  if (booking.status === 'confirmed') {
    const { data: moved } = await db
      .from('paymentx_orders')
      .update({ status: 'paid', paid_order_no: paidOrderNo, updated_at: now, completed_at: now })
      .eq('id', order.id)
      .in('status', ['creating', 'pending', 'cancelled'])
      .select('id')
    // Confirmed earlier by a DIFFERENT order (another cashier order, or a direct KPay payment):
    // this payment is a duplicate charge.
    if (
      moved && moved.length > 0 &&
      booking.stripe_payment_intent &&
      booking.stripe_payment_intent !== `managed_${order.managed_order_no}`
    ) {
      await logPaymentEvent({
        bookingId: booking.id,
        orderGroupId: booking.order_group_id,
        event: 'duplicate_payment',
        source: eventSource,
        providerOrderNo: order.managed_order_no,
        reason: `booking already confirmed by ${booking.stripe_payment_intent}`,
        meta: { paidOrderNo },
      })
      await logSiteError('payments/duplicate', 'error', 'PaymentX payment on an already confirmed booking: refund manually', {
        bookingId: booking.id,
        providerOrderNo: order.managed_order_no,
        paidOrderNo,
        confirmedOrderNo: booking.stripe_payment_intent,
        amount: result.payAmount,
      })
    }
    if (moved && moved.length > 0) {
      await logPaymentEvent({
        bookingId: booking.id,
        orderGroupId: booking.order_group_id,
        event: 'paymentx_paid_confirmed',
        source: eventSource,
        providerOrderNo: order.managed_order_no,
        reason: 'booking_already_confirmed',
        meta: { paidOrderNo },
      })
    }
    return 'already_confirmed'
  }

  const confirmed = await confirmBooking(booking, order.managed_order_no)
  if (confirmed) {
    await sendConfirmationEmails(booking)
    await db
      .from('paymentx_orders')
      .update({ status: 'paid', paid_order_no: paidOrderNo, updated_at: now, completed_at: now })
      .eq('id', order.id)
      .in('status', ['creating', 'pending', 'cancelled'])
    await logPaymentEvent({
      bookingId: booking.id,
      orderGroupId: booking.order_group_id,
      event: 'paymentx_paid_confirmed',
      source: eventSource,
      fromState: booking.status,
      toState: 'confirmed',
      providerOrderNo: order.managed_order_no,
      meta: { paidOrderNo },
    })
    return 'confirmed'
  }

  // The confirm RPC refused (slot taken, booking in an unconfirmable state …).
  await db
    .from('paymentx_orders')
    .update({ status: 'needs_review', paid_order_no: paidOrderNo, updated_at: now, completed_at: now })
    .eq('id', order.id)
    .in('status', ['creating', 'pending', 'cancelled'])
  await parkPaidBookingForReview({
    bookingId: booking.id,
    orderGroupId: booking.order_group_id,
    providerOrderNo: order.managed_order_no,
    source: eventSource,
    reason: 'paymentx_confirm_rejected',
    amount: expected,
  })
  return 'needs_review'
}

async function confirmBooking(booking: BookingRow, managedOrderNo: string): Promise<boolean> {
  const db = getLegacyServiceSupabase()
  const method = booking.payment_method ?? 'paymentx'
  const ref = `managed_${managedOrderNo}`
  try {
    if (booking.order_group_id) {
      const { data: group } = await db.from('bookings').select('id').eq('order_group_id', booking.order_group_id)
      const qr: Record<string, string> = {}
      for (const g of (group ?? []) as { id: string }[]) qr[g.id] = humanReadableCode(g.id)
      const { data, error } = await db.rpc('confirm_booking_group', {
        p_order_group_id: booking.order_group_id,
        p_payment_intent_id: ref,
        p_payment_method: method,
        p_qr_codes: qr,
        p_event_id: `paymentx:${managedOrderNo}`,
      })
      return !error && (data as { success?: boolean } | null)?.success !== false
    }
    const { data, error } = await db.rpc('confirm_booking', {
      p_booking_id: booking.id,
      p_payment_intent_id: ref,
      p_payment_method: method,
      p_qr_code: booking.human_code ?? humanReadableCode(booking.id),
      p_event_id: `paymentx:${managedOrderNo}`,
    })
    return !error && (data as { success?: boolean } | null)?.success !== false
  } catch (e) {
    console.warn('[paymentx/settle] confirm threw', (e as Error).message)
    return false
  }
}

// Booking confirmation email + notification log, once per booking. The stamp
// confirmation_email_sent_at (set by sendBookingConfirmation) makes this idempotent, so a poll
// and a webhook racing each other cannot send two. Never throws: a mail failure must not undo
// a confirmed booking, it is logged for 後台 → 錯誤記錄.
async function sendConfirmationEmails(booking: BookingRow): Promise<void> {
  const db = getLegacyServiceSupabase()
  try {
    const base = db.from('bookings').select('id, user_id, confirmation_email_sent_at, status')
    const { data } = booking.order_group_id
      ? await base.eq('order_group_id', booking.order_group_id)
      : await base.eq('id', booking.id)
    const list = (data ?? []) as { id: string; user_id: string; confirmation_email_sent_at: string | null; status: string }[]
    for (const b of list) {
      if (b.status !== 'confirmed' || b.confirmation_email_sent_at) continue
      try {
        const { sendBookingConfirmation } = await import('@/lib/resend/template-send')
        await sendBookingConfirmation(b.id)
        await db.from('notification_log').insert([
          { user_id: b.user_id, booking_id: b.id, channel: 'email', type: 'booking_confirmed', status: 'sent' },
          { user_id: b.user_id, booking_id: b.id, channel: 'whatsapp', type: 'booking_confirmed', status: 'pending' },
        ])
      } catch (e) {
        await logSiteError('paymentx/email', 'warning', 'booking confirmation email failed', { bookingId: b.id, message: (e as Error).message })
      }
    }
  } catch (e) {
    console.warn('[paymentx/settle] confirmation email step failed', (e as Error).message)
  }
}
