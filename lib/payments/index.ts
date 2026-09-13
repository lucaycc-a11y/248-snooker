// ─────────────────────────────────────────────────────────────────
// Payment provider factory — single selection point for Stripe vs KPay.
// Reads PAYMENT_PROVIDER env var: 'stripe' | 'kpay' (default).
//
// Stripe code integration added 2026-09-12 to support Card, Alipay,
// Google Pay, Apple Pay, and WeChat Pay. KPay remains fully intact.
// ─────────────────────────────────────────────────────────────────

import type { PaymentProvider } from './types'
import { KPayProvider } from './kpay'
import { StripeProvider } from './stripe'

// Cache providers per hostname to ensure UAT and production use different
// KPay environments (UAT domain always uses KPay UAT keys, production domain
// respects KPAY_ENV). The cache is per-serverless-instance, which is fine —
// cross-domain requests are rare and the overhead of creating a new provider
// is minimal (just env var reads + key validation).
const kpayProviderCache = new Map<string, KPayProvider>()

/**
 * Single provider-selection point — reads PAYMENT_PROVIDER env var.
 * Returns Stripe for 'stripe', KPay for 'kpay' (default).
 *
 * @param hostname - Request hostname (e.g., 'uat.space8.com.hk') for
 *   environment-aware KPay key selection. Only used for KPay provider.
 */
export function getPaymentProvider(hostname?: string): PaymentProvider {
  const providerName = process.env.PAYMENT_PROVIDER || 'kpay'

  if (providerName === 'stripe') {
    return new StripeProvider()
  }

  // KPay: use cached provider per hostname
  const key = hostname ?? 'default'
  let provider = kpayProviderCache.get(key)
  if (!provider) {
    provider = new KPayProvider(hostname)
    kpayProviderCache.set(key, provider)
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
