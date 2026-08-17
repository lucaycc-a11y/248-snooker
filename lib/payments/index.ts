// ─────────────────────────────────────────────────────────────────
// Payment provider — KPay is the sole checkout provider.
// Apple Pay / Google Pay are UI-only "coming soon" and never reach
// this module (blocked at the API route layer with 400).
//
// Stripe code is preserved in ./stripe.ts for future re-enablement
// (Apple Pay / Google Pay) but is NOT imported or referenced here.
// ─────────────────────────────────────────────────────────────────

import type { PaymentProvider } from './types'
import { KPayProvider } from './kpay'

let kpayProvider: KPayProvider | null = null

/**
 * Return the singleton KPayProvider. Throws on missing env vars.
 * Apple Pay / Google Pay are blocked upstream — they never call this.
 */
export function getPaymentProvider(): PaymentProvider {
  if (!kpayProvider) {
    kpayProvider = new KPayProvider()
  }
  return kpayProvider
}

/**
 * Read payment method enabled/disabled from payment_settings.
 * Returns null if the method has no row (apple_pay / google_pay don't).
 */
export async function getPaymentMethodSettings(
  method: string,
): Promise<{ enabled: boolean } | null> {
  const { getServiceSupabase } = await import('@/lib/supabase/service')
  const supabase = getServiceSupabase()
  const { data, error } = await supabase
    .from('payment_settings')
    .select('enabled')
    .eq('method', method)
    .maybeSingle()

  if (error || !data) return null
  return { enabled: data.enabled as boolean }
}
