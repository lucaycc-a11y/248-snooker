import type { getServiceSupabase } from '@/lib/supabase/service'
import { logPaymentEvent } from '@/lib/payments/payment-events'

type ServiceClient = ReturnType<typeof getServiceSupabase>

// A customer who abandons a KPay checkout (closes the tab, loses signal) leaves a
// pending booking holding their Space Wallet credit. When the next checkout then fails
// with `insufficient_credits`, this releases ONLY the holds that are provably dead, then
// lets the caller retry once.
//
// "Provably dead" is deliberately strict, because releasing the hold of an order that
// can still be paid would let a late payment land without its credit, and nothing
// refunds a late payment automatically:
//   - never reached the provider (no provider_order_no), or
//   - KPay itself reports the order failed / cancelled / closed.
// A paid order is never touched (the webhook / status poll confirms it), and neither is
// anything uncertain (a lookup error, a Stripe intent). A still-payable order is released
// at once when the customer starts a new checkout (freezePending = false): they asked to
// book again, and a late payment is handled by the late-payment path.

type PendingRow = {
  id: string
  order_group_id: string | null
  provider_order_no: string | null
  payment_method: string | null
  created_at: string
}

export async function releaseDeadPendingOrders(
  service: ServiceClient,
  userId: string,
  keepBookingId: string,
  freezePending = false,
): Promise<number> {
  const { data: rows, error } = await service
    .from('bookings')
    .select('id, order_group_id, provider_order_no, payment_method, created_at')
    .eq('user_id', userId)
    .in('status', ['pending', 'payment_failed'])
    .neq('id', keepBookingId)
  if (error || !rows || rows.length === 0) return 0

  // Skip the current checkout's own group.
  const { data: keepRow } = await service
    .from('bookings')
    .select('order_group_id')
    .eq('id', keepBookingId)
    .maybeSingle()
  const keepGroup = keepRow?.order_group_id ?? null

  let provider: { queryOrder: (n: string) => Promise<{ status: string }> } | null = null
  const handledGroups = new Set<string>()
  let released = 0
  const openOrderNos: string[] = []

  for (const row of rows as PendingRow[]) {
    if (keepGroup && row.order_group_id === keepGroup) continue
    const groupKey = row.order_group_id ?? row.id
    if (handledGroups.has(groupKey)) continue

    let dead = false
    if (!row.provider_order_no) {
      dead = true
    } else if (/^\d{12,}$/.test(row.provider_order_no)) {
      try {
        if (!provider) {
          const { KPayProvider } = await import('@/lib/payments/kpay')
          provider = new KPayProvider(undefined, 'prod')
        }
        const status = await provider.queryOrder(row.provider_order_no)
        if (status.status === 'failed' || status.status === 'cancelled' || status.status === 'closed') {
          dead = true
        } else if (status.status === 'pending' && !freezePending) {
          // The customer is starting a new checkout, so a still-payable (unpaid) order is
          // treated as abandoned and released at once. If it is paid later the webhook /
          // reconcile confirms it (re-applying the credit) or parks it in payment_review.
          dead = true
          openOrderNos.push(row.provider_order_no)
        }
      } catch (e) {
        console.warn('[checkout] supersede query failed — leaving order alone', {
          bookingId: row.id,
          message: (e as Error).message,
        })
      }
    }
    if (!dead) continue

    handledGroups.add(groupKey)
    const { data, error: cancelErr } = await service.rpc('cancel_pending_booking', {
      p_booking_id: row.id,
      p_user_id: userId,
    })
    if (cancelErr) {
      console.warn('[checkout] supersede cancel failed', { bookingId: row.id, message: cancelErr.message })
      continue
    }
    if ((data as { success?: boolean } | null)?.success === true) {
      released += 1
      if (row.provider_order_no && openOrderNos.includes(row.provider_order_no)) {
        await logPaymentEvent({
          bookingId: row.id,
          orderGroupId: row.order_group_id,
          providerOrderNo: row.provider_order_no,
          event: 'superseded_open_order',
          source: 'user',
          fromState: 'pending',
          toState: 'cancelled',
          reason: 'customer_started_new_checkout',
        })
      }
    }
  }
  return released
}

// One pending booking per customer per slot. Starting a new checkout for a slot the same
// customer already has a pending / payment_failed booking on first releases the old one at once
// (slot, credit and promo holds), so repeated attempts never pile up as parallel pending rows
// (SPACE8-PSURG-K). It must run BEFORE the new slot lock is taken: cancelling frees the slot.
// A booking whose KPay order is already PAID is never released: the caller gets `paidBookingId`
// and must stop, the status poll confirms that booking. An unpaid open order is released and, if
// paid later, the webhook revives it or parks it in payment_review.
export type SameSlotRelease = { released: number; paidBookingId: string | null }

export async function releaseSameSlotPending(
  service: ServiceClient,
  userId: string,
  blocks: { date: string; startHour: number; tableNumber: number }[],
  hostname: string,
): Promise<SameSlotRelease> {
  const result: SameSlotRelease = { released: 0, paidBookingId: null }
  try {
    const slotIds: string[] = []
    for (const b of blocks) {
      const { data: slots } = await service
        .from('slots')
        .select('id')
        .eq('date', b.date)
        .eq('start_time', `${String(b.startHour).padStart(2, '0')}:00:00`)
        .eq('table_number', b.tableNumber)
      for (const s of (slots ?? []) as { id: string }[]) slotIds.push(s.id)
    }
    if (slotIds.length === 0) return result

    const { data: rows } = await service
      .from('bookings')
      .select('id, order_group_id, provider_order_no')
      .eq('user_id', userId)
      .in('slot_id', slotIds)
      .in('status', ['pending', 'payment_failed'])
    if (!rows || rows.length === 0) return result

    const { getLiveKPayState } = await import('@/lib/payments/live-order')
    const done = new Set<string>()
    for (const row of rows as { id: string; order_group_id: string | null; provider_order_no: string | null }[]) {
      const key = row.order_group_id ?? row.id
      if (done.has(key)) continue
      const live = await getLiveKPayState(row.provider_order_no, hostname)
      if (live === 'paid') {
        result.paidBookingId = row.id
        return result
      }
      const { data, error } = await service.rpc('cancel_pending_booking', { p_booking_id: row.id, p_user_id: userId })
      if (error || (data as { success?: boolean } | null)?.success !== true) continue
      done.add(key)
      result.released += 1
      await service
        .from('payment_attempts')
        .update({ status: 'cancelled', failure_code: 'superseded_same_slot', updated_at: new Date().toISOString() })
        .eq('booking_id', row.id)
        .in('status', ['claimed', 'pending'])
      await logPaymentEvent({
        bookingId: row.id,
        orderGroupId: row.order_group_id,
        providerOrderNo: row.provider_order_no,
        event: 'superseded_open_order',
        source: 'user',
        fromState: 'pending',
        toState: 'cancelled',
        reason: 'same_slot_new_checkout',
      })
    }
  } catch (e) {
    console.warn('[checkout] releaseSameSlotPending failed', { message: (e as Error).message })
  }
  return result
}

// Account checkout lock: while one of the customer's bookings has a KPay order that was opened
// in the last LOCK_MINUTES and is still payable, no other checkout can start on that account
// (any slot, any device). Space Credit / promo holds of that booking therefore cannot be
// re-used by a second checkout while the first order can still be paid. Cancelling the booking
// (the customer's explicit cancel) unlocks at once; otherwise the lock ends when the order is
// paid, closed, or LOCK_MINUTES have passed. A lookup failure never locks (fail open).
export const CHECKOUT_LOCK_MINUTES = 10
export type AccountLock = { paidBookingId: string | null; lockedBookingId: string | null; lockedUntil: string | null }

export async function getAccountCheckoutLock(
  service: ServiceClient,
  userId: string,
  hostname: string,
  exclude?: { bookingId?: string | null; orderGroupId?: string | null },
): Promise<AccountLock> {
  const none: AccountLock = { paidBookingId: null, lockedBookingId: null, lockedUntil: null }
  try {
    const since = new Date(Date.now() - CHECKOUT_LOCK_MINUTES * 60_000).toISOString()
    const { data: attempts } = await service
      .from('payment_attempts')
      .select('booking_id, provider_order_no, created_at')
      .eq('user_id', userId)
      .in('status', ['claimed', 'pending'])
      .gt('created_at', since)
      .not('provider_order_no', 'is', null)
      .order('created_at', { ascending: false })
    if (!attempts || attempts.length === 0) return none

    const { getLiveKPayState } = await import('@/lib/payments/live-order')
    for (const a of attempts as { booking_id: string; provider_order_no: string; created_at: string }[]) {
      const { data: b } = await service
        .from('bookings')
        .select('id, status, order_group_id')
        .eq('id', a.booking_id)
        .eq('user_id', userId)
        .maybeSingle()
      if (!b || (b.status !== 'pending' && b.status !== 'payment_failed')) continue
      // The checkout being continued is not "another" checkout.
      if (exclude?.bookingId && b.id === exclude.bookingId) continue
      if (exclude?.orderGroupId && b.order_group_id === exclude.orderGroupId) continue
      const live = await getLiveKPayState(a.provider_order_no, hostname)
      if (live === 'paid') return { ...none, paidBookingId: b.id }
      if (live === 'pending') {
        const until = new Date(new Date(a.created_at).getTime() + CHECKOUT_LOCK_MINUTES * 60_000).toISOString()
        return { ...none, lockedBookingId: b.id, lockedUntil: until }
      }
    }
  } catch (e) {
    console.warn('[checkout] getAccountCheckoutLock failed — not locking', { message: (e as Error).message })
  }
  return none
}
