import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'

// PaymentX's own event log (KPay notify payloads, settle decisions). Never throws.
export async function logPaymentXEvent(input: {
  kind: string
  bookingId?: string | null
  managedOrderNo?: string | null
  note?: string | null
  payload?: Record<string, unknown> | null
}): Promise<void> {
  try {
    const { error } = await getLegacyServiceSupabase().from('paymentx_events').insert({
      kind: input.kind,
      booking_id: input.bookingId ?? null,
      managed_order_no: input.managedOrderNo ?? null,
      note: input.note ?? null,
      payload: input.payload ?? null,
    })
    if (error) console.warn('[paymentx/events] insert failed', error.message)
  } catch (e) {
    console.warn('[paymentx/events] insert threw', (e as Error).message)
  }
}
