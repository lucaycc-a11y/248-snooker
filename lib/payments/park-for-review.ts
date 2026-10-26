import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'
import { logSiteError } from '@/lib/errors/log'
import { logPaymentEvent, type PaymentEventSource } from '@/lib/payments/payment-events'

// Statuses that mean "we already let this booking go". A payment landing on one of
// these cannot be confirmed safely (the slot may belong to someone else now).
const RELEASED_STATUSES = ['cancelled', 'expired', 'payment_failed']

export type ParkInput = {
  bookingId: string
  orderGroupId: string | null
  providerOrderNo: string
  source: PaymentEventSource
  reason: string
  amount?: number | null
}

// Money arrived for a booking that cannot be confirmed. NO money is moved and no
// refund is attempted: the booking is marked payment_review, a payment_events row is
// written and an error goes to site_error_log (the admin alert pipeline) so a person
// handles it. Returns how many booking rows were moved to payment_review.
export async function parkPaidBookingForReview(input: ParkInput): Promise<number> {
  const supabase = getLegacyServiceSupabase()
  const query = supabase.from('bookings').select('id, status, admin_note')
  const { data: rows, error } = input.orderGroupId
    ? await query.eq('order_group_id', input.orderGroupId)
    : await query.eq('id', input.bookingId)

  let moved = 0
  const stamp = new Date().toISOString()
  if (!error && rows) {
    for (const row of rows) {
      if (!RELEASED_STATUSES.includes(String(row.status))) continue
      const note = `${row.admin_note ? `${row.admin_note}\n` : ''}[${stamp}] Paid via KPay order ${input.providerOrderNo} after release (${input.reason}); needs manual handling`
      const { error: updErr } = await supabase
        .from('bookings')
        .update({ status: 'payment_review', admin_note: note })
        .eq('id', row.id)
        .in('status', RELEASED_STATUSES)
      if (!updErr) moved += 1
    }
  }

  await logPaymentEvent({
    bookingId: input.bookingId,
    orderGroupId: input.orderGroupId,
    providerOrderNo: input.providerOrderNo,
    event: 'paid_unconfirmable',
    source: input.source,
    toState: 'payment_review',
    reason: input.reason,
    meta: { rowsMoved: moved, amount: input.amount ?? null },
  })
  await logSiteError('payments/review', 'error', 'Paid order needs manual handling (payment_review)', {
    bookingId: input.bookingId,
    orderGroupId: input.orderGroupId,
    providerOrderNo: input.providerOrderNo,
    reason: input.reason,
    amount: input.amount ?? null,
    rowsMoved: moved,
  })
  return moved
}
