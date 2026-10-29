import type { SupabaseClient } from '@supabase/supabase-js'
import { getLiveKPayState } from '@/lib/payments/live-order'
import { logPaymentEvent } from '@/lib/payments/payment-events'

// Server-side release of a stale pending checkout the customer is abandoning on purpose, e.g. the
// page's price no longer matches the booking it adopted (wallet toggled after an earlier attempt).
// Same rules as /api/checkout/cancel: a PAID KPay order is never released; an order that is still
// open (unpaid) or unknown is released at once and, if paid later, the webhook / reconcile
// confirms it or parks it in payment_review. Returns true when the booking is now released.
export async function releaseStaleCheckout(
  service: SupabaseClient,
  input: { userId: string; bookingId: string; hostname: string; reason: string },
): Promise<boolean> {
  try {
    const { data: row } = await service
      .from('bookings')
      .select('id, status, provider_order_no, order_group_id')
      .eq('id', input.bookingId)
      .eq('user_id', input.userId)
      .maybeSingle()
    if (!row) return false
    if (row.status === 'cancelled') return true
    if (row.status !== 'pending' && row.status !== 'payment_failed') return false

    const live = await getLiveKPayState(row.provider_order_no, input.hostname)
    if (live === 'paid') return false

    const { data, error } = await service.rpc('cancel_pending_booking', {
      p_booking_id: input.bookingId,
      p_user_id: input.userId,
    })
    if (error || !data || typeof data !== 'object' || (data as Record<string, unknown>).success !== true) return false

    await service
      .from('payment_attempts')
      .update({ status: 'cancelled', failure_code: 'cancelled_by_user', updated_at: new Date().toISOString() })
      .eq('booking_id', input.bookingId)
      .in('status', ['claimed', 'pending'])
    await logPaymentEvent({
      bookingId: input.bookingId,
      orderGroupId: row.order_group_id ?? null,
      providerOrderNo: row.provider_order_no ?? null,
      event: 'cancelled_by_user',
      source: 'system',
      fromState: row.status,
      toState: 'cancelled',
      reason: input.reason,
    })
    return true
  } catch (e) {
    console.warn('[checkout] releaseStaleCheckout failed', { bookingId: input.bookingId, message: (e as Error).message })
    return false
  }
}
