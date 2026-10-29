import { getEffectivePaymentSystem } from '@/lib/payments/system'

// PaymentX is used by an account when its effective payment system is 'paymentx': either an
// admin gave that account a PaymentX override (後台 → 設定 → 支付系統) or the public system was
// switched to PaymentX. Fails closed: a lookup problem falls back to the env default (never
// paymentx), so the hosted cashier is never offered by accident.
export async function isPaymentXTester(userId: string): Promise<boolean> {
  return (await getEffectivePaymentSystem(userId)) === 'paymentx'
}
