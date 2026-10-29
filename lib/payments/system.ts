import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'

// Which payment system a checkout uses: kpay (direct connect), stripe, or paymentx (KPay hosted
// cashier). A per-account override (admin-selected) wins over the public system. Any lookup
// problem falls back to what the deployment did before this switch existed (the env default), so
// a database hiccup can never move customers onto a different gateway.

export type PaymentSystem = 'kpay' | 'stripe' | 'paymentx'
export const PAYMENT_SYSTEMS: readonly PaymentSystem[] = ['kpay', 'stripe', 'paymentx']

export function isPaymentSystem(v: unknown): v is PaymentSystem {
  return v === 'kpay' || v === 'stripe' || v === 'paymentx'
}

function envDefault(): PaymentSystem {
  return (process.env.PAYMENT_PROVIDER || process.env.NEXT_PUBLIC_PAYMENT_PROVIDER) === 'stripe' ? 'stripe' : 'kpay'
}

export async function getPublicPaymentSystem(): Promise<PaymentSystem> {
  try {
    const { data, error } = await getLegacyServiceSupabase()
      .from('payment_system_config')
      .select('public_system')
      .eq('id', 1)
      .maybeSingle()
    if (error || !data) return envDefault()
    const v = (data as { public_system?: unknown }).public_system
    return isPaymentSystem(v) ? v : envDefault()
  } catch {
    return envDefault()
  }
}

export async function getEffectivePaymentSystem(userId: string | null): Promise<PaymentSystem> {
  if (userId) {
    try {
      const { data } = await getLegacyServiceSupabase()
        .from('payment_system_overrides')
        .select('system')
        .eq('user_id', userId)
        .maybeSingle()
      const v = data ? (data as { system?: unknown }).system : null
      if (isPaymentSystem(v)) return v
    } catch {
      /* fall through to the public system */
    }
  }
  return getPublicPaymentSystem()
}
