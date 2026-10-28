import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'
import { getLiveKPayState, isKPayOrderNo } from '@/lib/payments/live-order'
import { logPaymentEvent } from '@/lib/payments/payment-events'
import { humanReadableCode } from '@/lib/qr/jwt'

// Closes out payment_attempts that are still 'claimed' / 'pending' long after the
// customer left. It asks KPay what really happened to each order:
//   paid    -> confirm the booking (same RPCs the webhook uses), never refunds
//   closed  -> attempt marked failed
//   pending -> left alone until it is old enough that KPay must have expired it
//   unknown -> left alone (never decide on a failed lookup)
// Attempts that never got a KPay order are simply marked expired.

const NO_ORDER_AFTER_MIN = 20
const ORDER_CHECK_AFTER_MIN = 12
const ORDER_EXPIRED_AFTER_MIN = 25

export type ReconcileAction =
  | 'expired_no_order'
  | 'closed_marked_failed'
  | 'paid_confirmed'
  | 'paid_confirm_failed'
  | 'paid_needs_attention'
  | 'expired_old_pending'
  | 'still_payable'
  | 'lookup_unknown'

export type ReconcileItem = {
  attemptId: string
  bookingId: string | null
  humanCode: string | null
  providerOrderNo: string | null
  ageMin: number
  action: ReconcileAction
  note?: string
}

type AttemptRow = {
  id: string
  booking_id: string | null
  order_group_id: string | null
  provider_order_no: string | null
  status: string
  created_at: string
}

type BookingRow = {
  id: string
  human_code: string | null
  status: string
  order_group_id: string | null
  is_test: boolean | null
}

export async function reconcileStaleAttempts(options: {
  /** Confirm bookings whose KPay order turned out to be paid. */
  confirmPaid: boolean
  source: 'cron' | 'admin'
  limit?: number
}): Promise<ReconcileItem[]> {
  const db = getLegacyServiceSupabase()
  const cutoff = new Date(Date.now() - Math.min(NO_ORDER_AFTER_MIN, ORDER_CHECK_AFTER_MIN) * 60_000).toISOString()

  const { data: attempts } = await db
    .from('payment_attempts')
    .select('id, booking_id, order_group_id, provider_order_no, status, created_at')
    .in('status', ['claimed', 'pending'])
    .lt('created_at', cutoff)
    .order('created_at', { ascending: true })
    .limit(options.limit ?? 60)

  const rows = (attempts ?? []) as AttemptRow[]
  if (rows.length === 0) return []

  const bookingIds = [...new Set(rows.map((r) => r.booking_id).filter((v): v is string => !!v))]
  const { data: bookings } = bookingIds.length
    ? await db.from('bookings').select('id, human_code, status, order_group_id, is_test').in('id', bookingIds)
    : { data: [] }
  const byId = new Map<string, BookingRow>(((bookings ?? []) as BookingRow[]).map((b) => [b.id, b]))

  const items: ReconcileItem[] = []
  for (const a of rows) {
    const ageMin = Math.round((Date.now() - new Date(a.created_at).getTime()) / 60_000)
    const booking = a.booking_id ? byId.get(a.booking_id) ?? null : null
    const base = {
      attemptId: a.id,
      bookingId: a.booking_id,
      humanCode: booking?.human_code ?? null,
      providerOrderNo: a.provider_order_no,
      ageMin,
    }

    // 0) The booking is already confirmed but its attempt never got closed out
    //    (e.g. the order number was not recorded on the attempt). Close it as
    //    succeeded instead of calling a paid booking "no order created".
    if (booking?.status === 'confirmed') {
      await db
        .from('payment_attempts')
        .update({ status: 'succeeded', completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', a.id)
        .in('status', ['claimed', 'pending'])
      items.push({ ...base, action: 'paid_confirmed', note: '訂位已確認，補回付款記錄' })
      continue
    }

    // 1) No KPay order was ever created -> nothing can be paid.
    if (!isKPayOrderNo(a.provider_order_no)) {
      if (ageMin < NO_ORDER_AFTER_MIN) continue
      await db
        .from('payment_attempts')
        .update({ status: 'expired', failure_code: 'no_order_created', updated_at: new Date().toISOString() })
        .eq('id', a.id)
        .in('status', ['claimed', 'pending'])
      items.push({ ...base, action: 'expired_no_order' })
      continue
    }

    if (ageMin < ORDER_CHECK_AFTER_MIN) continue

    // 2) A KPay order exists -> ask KPay.
    const state = await getLiveKPayState(a.provider_order_no)

    if (state === 'paid') {
      if (!booking || !options.confirmPaid) {
        items.push({ ...base, action: 'paid_needs_attention', note: booking ? 'KPay 已收款，等待確認' : '找不到訂位' })
        continue
      }
      const ok = await confirmPaidBooking(booking, a.provider_order_no)
      if (booking.id) {
        await logPaymentEvent({
          bookingId: booking.id,
          event: ok ? 'reconcile_paid_confirmed' : 'reconcile_paid_confirm_failed',
          source: options.source === 'cron' ? 'cron' : 'admin',
          providerOrderNo: a.provider_order_no,
          attemptId: a.id,
          fromState: booking.status,
        })
      }
      items.push({ ...base, action: ok ? 'paid_confirmed' : 'paid_confirm_failed' })
      continue
    }

    if (state === 'closed') {
      await db
        .from('payment_attempts')
        .update({ status: 'failed', failure_code: 'kpay_closed', updated_at: new Date().toISOString() })
        .eq('id', a.id)
        .in('status', ['claimed', 'pending'])
      if (booking) {
        await logPaymentEvent({
          bookingId: booking.id,
          event: 'reconcile_order_closed',
          source: options.source === 'cron' ? 'cron' : 'admin',
          providerOrderNo: a.provider_order_no,
          attemptId: a.id,
        })
      }
      items.push({ ...base, action: 'closed_marked_failed' })
      continue
    }

    if (state === 'pending') {
      if (ageMin >= ORDER_EXPIRED_AFTER_MIN) {
        await db
          .from('payment_attempts')
          .update({ status: 'expired', failure_code: 'kpay_still_open_but_stale', updated_at: new Date().toISOString() })
          .eq('id', a.id)
          .in('status', ['claimed', 'pending'])
        items.push({ ...base, action: 'expired_old_pending', note: 'KPay 仍顯示未付款，超過 25 分鐘' })
      } else {
        items.push({ ...base, action: 'still_payable' })
      }
      continue
    }

    items.push({ ...base, action: 'lookup_unknown' })
  }
  return items
}

async function confirmPaidBooking(booking: BookingRow, providerOrderNo: string): Promise<boolean> {
  const db = getLegacyServiceSupabase()
  try {
    if (booking.order_group_id) {
      const { data: group } = await db.from('bookings').select('id').eq('order_group_id', booking.order_group_id)
      const qr: Record<string, string> = {}
      for (const g of (group ?? []) as { id: string }[]) qr[g.id] = humanReadableCode(g.id)
      const { data, error } = await db.rpc('confirm_booking_group', {
        p_order_group_id: booking.order_group_id,
        p_payment_intent_id: providerOrderNo,
        p_payment_method: 'kpay',
        p_qr_codes: qr,
        p_event_id: `reconcile:${providerOrderNo}`,
      })
      if (error || (data as { success?: boolean } | null)?.success === false) return false
    } else {
      const { data, error } = await db.rpc('confirm_booking', {
        p_booking_id: booking.id,
        p_payment_intent_id: providerOrderNo,
        p_payment_method: 'kpay',
        p_qr_code: booking.human_code ?? humanReadableCode(booking.id),
        p_event_id: `reconcile:${providerOrderNo}`,
      })
      if (error || (data as { success?: boolean } | null)?.success === false) return false
    }
    await db.rpc('complete_payment_attempt', { p_provider_order_no: providerOrderNo, p_provider: 'kpay' })
    return true
  } catch {
    return false
  }
}
