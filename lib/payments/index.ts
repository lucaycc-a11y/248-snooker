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

// Cache providers per hostname to ensure UAT and production use different
// KPay environments (UAT domain always uses KPay UAT keys, production domain
// respects KPAY_ENV). The cache is per-serverless-instance, which is fine —
// cross-domain requests are rare and the overhead of creating a new provider
// is minimal (just env var reads + key validation).
const providerCache = new Map<string, KPayProvider>()

/**
 * Return a KPayProvider for the given hostname. Throws on missing env vars.
 * Apple Pay / Google Pay are blocked upstream — they never call this.
 *
 * @param hostname - Request hostname (e.g., 'uat.space8.com.hk') for
 *   environment-aware KPay key selection. If omitted, uses default env.
 */
export function getPaymentProvider(hostname?: string): PaymentProvider {
  const key = hostname ?? 'default'
  let provider = providerCache.get(key)
  if (!provider) {
    provider = new KPayProvider(hostname)
    providerCache.set(key, provider)
  }
  return provider
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
