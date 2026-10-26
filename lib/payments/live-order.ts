import { KPayProvider } from '@/lib/payments/kpay'
import { isUatEnv } from '@/lib/env/uat'

// What KPay itself says about an order, collapsed to the four answers every
// cancel / release / status decision needs.
//   paid    – money received; the booking must be confirmed or parked for review
//   pending – order still payable; the booking, slot and credit/promo holds are frozen
//   closed  – KPay closed / failed / cancelled / refunded the order; safe to release
//   unknown – lookup failed; treat as pending (never release on a guess)
//   none    – no KPay order was ever created; safe to release
export type LiveOrderState = 'paid' | 'pending' | 'closed' | 'unknown' | 'none'

export function isKPayOrderNo(value: string | null | undefined): value is string {
  return typeof value === 'string' && /^\d{12,}$/.test(value)
}

export async function getLiveKPayState(
  providerOrderNo: string | null | undefined,
  hostname?: string,
): Promise<LiveOrderState> {
  if (!isKPayOrderNo(providerOrderNo)) return 'none'
  try {
    const provider = hostname && isUatEnv(hostname)
      ? new KPayProvider(hostname)
      : new KPayProvider(undefined, 'prod')
    const live = await provider.queryOrder(providerOrderNo)
    switch (live.status) {
      case 'success':
        return 'paid'
      case 'pending':
        return 'pending'
      case 'failed':
      case 'cancelled':
      case 'closed':
      case 'refunded':
        return 'closed'
      default:
        return 'unknown'
    }
  } catch (e) {
    console.warn('[live-order] kpay query failed', { providerOrderNo, message: (e as Error).message })
    return 'unknown'
  }
}
