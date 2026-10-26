import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'

export type PaymentEventSource = 'webhook' | 'status_poll' | 'cron' | 'user' | 'admin' | 'db' | 'system'

export type PaymentEventInput = {
  bookingId: string
  event: string
  source: PaymentEventSource
  fromState?: string | null
  toState?: string | null
  reason?: string | null
  providerOrderNo?: string | null
  attemptId?: string | null
  orderGroupId?: string | null
  meta?: Record<string, unknown>
}

// Appends one row to the admin-only payment_events timeline through the
// log_payment_event RPC. Never throws: a missing RPC (migration not applied yet)
// or a DB hiccup must not change the outcome of a payment decision.
export async function logPaymentEvent(input: PaymentEventInput): Promise<void> {
  try {
    const { error } = await getLegacyServiceSupabase().rpc('log_payment_event', {
      p_booking_id: input.bookingId,
      p_event: input.event,
      p_source: input.source,
      p_from_state: input.fromState ?? null,
      p_to_state: input.toState ?? null,
      p_reason: input.reason ?? null,
      p_provider_order_no: input.providerOrderNo ?? null,
      p_attempt_id: input.attemptId ?? null,
      p_order_group_id: input.orderGroupId ?? null,
      p_meta: input.meta ?? {},
    })
    if (error) console.warn('[payment-events] log_failed', { message: error.message, event: input.event })
  } catch (e) {
    console.warn('[payment-events] log_failed', { message: (e as Error).message, event: input.event })
  }
}
