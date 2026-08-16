// ─────────────────────────────────────────────────────────────────
// Payment provider factory — resolves the right provider for a
// given payment method.
// ─────────────────────────────────────────────────────────────────

import type { PaymentMethod, PaymentProvider } from './types'
import { StripeProvider } from './stripe'
import { KPayProvider } from './kpay'

// Cache providers as singletons (they validate env on construction).
let stripeProvider: StripeProvider | null = null
let kpayProvider: KPayProvider | null = null

const KPAY_METHODS: ReadonlySet<PaymentMethod> = new Set(['fps', 'payme', 'octopus'])

/**
 * Get the payment provider for a given method.
 *
 * card / apple_pay / google_pay always use Stripe.
 * fps / payme / octopus read payment_settings from the DB — only an
 * enabled 'kpay' row returns KPayProvider. Anything else (method
 * disabled, settings missing, or KPay env vars unset — the constructor
 * throws) RAISES a clear error. There is deliberately NO Stripe fallback
 * for KPay methods: a silent fallback would create Stripe intents for
 * FPS/PayMe/Octopus, which the spec explicitly forbids.
 */
export async function getProviderForMethod(
  method: PaymentMethod,
  options?: { getSettings?: (method: PaymentMethod) => Promise<{ provider: string; enabled: boolean } | null> },
): Promise<PaymentProvider> {
  // Stripe methods
  if (method === 'card' || method === 'apple_pay' || method === 'google_pay') {
    if (!stripeProvider) {
      try {
        stripeProvider = new StripeProvider()
      } catch {
        throw new Error('Stripe 未配置完成：缺少 STRIPE_SECRET_KEY')
      }
    }
    return stripeProvider
  }

  if (!KPAY_METHODS.has(method)) {
    throw new Error(`不支援的付款方式：${method}`)
  }

  // KPay methods — settings gate, then loud KPayProvider (throws if unconfigured).
  const settings = options?.getSettings ? await options.getSettings(method) : null
  if (settings && settings.enabled) {
    if (settings.provider === 'kpay') {
      if (!kpayProvider) {
        kpayProvider = new KPayProvider() // throws `KPay 未配置完成：缺少 …` if env missing
      }
      return kpayProvider
    }
    // Reached only when a settings row names a provider other than kpay for a
    // KPay method — unsupported, fail loudly rather than guessing.
    throw new Error(`付款方式 ${method} 的供應商設定無效：${settings.provider}`)
  }

  throw new Error(`付款方式未開啟：${method}（請於後台開啟後再試）`)
}

/**
 * Read payment method settings from the payment_settings table.
 */
export async function getPaymentMethodSettings(
  method: PaymentMethod,
): Promise<{ provider: string; enabled: boolean } | null> {
  // Dynamic import to avoid circular deps
  const { getServiceSupabase } = await import('@/lib/supabase/service')
  const supabase = getServiceSupabase()
  const { data, error } = await supabase
    .from('payment_settings')
    .select('provider, enabled')
    .eq('method', method)
    .maybeSingle()

  if (error || !data) return null
  return { provider: data.provider as string, enabled: data.enabled as boolean }
}