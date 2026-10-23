import type { getServiceSupabase } from '@/lib/supabase/service'

type ServiceClient = ReturnType<typeof getServiceSupabase>

// A customer who abandons a KPay checkout (closes the tab, loses signal) leaves a
// pending booking holding their Space Wallet credit until the 10-minute sweep. When
// the next checkout then fails with `insufficient_credits`, this releases ONLY the
// holds that are provably dead, then lets the caller retry once.
//
// "Provably dead" is deliberately strict, because releasing the hold of an order
// that can still be paid would let a late payment confirm without its credit:
//   - never reached the provider (no provider_order_no), or
//   - KPay itself reports the order failed / cancelled / closed, or
//   - KPay still says pending but the order is older than 30 s (the customer has
//     since started a new checkout, so the old cashier was abandoned).
// A paid order ('success') is never touched: the webhook confirms it.
// Anything uncertain — a lookup error, a Stripe intent — is left alone.

// The customer is actively starting a NEW checkout while an older order of theirs is
// still unpaid. After this age, an order KPay still reports as pending is treated as
// abandoned (they backed out of the cashier) instead of holding their wallet for the
// full 10-minute sweep. If it is somehow paid afterwards, the KPay webhook refunds a
// payment that lands on a cancelled booking, so no money is kept without a booking.
const ABANDONED_AFTER_MS = 30_000

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
): Promise<number> {
  const { data: rows, error } = await service
    .from('bookings')
    .select('id, order_group_id, provider_order_no, payment_method, created_at')
    .eq('user_id', userId)
    .eq('status', 'pending')
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
        } else if (status.status === 'pending') {
          dead = Date.now() - new Date(row.created_at).getTime() > ABANDONED_AFTER_MS
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
    if ((data as { success?: boolean } | null)?.success === true) released += 1
  }
  return released
}
