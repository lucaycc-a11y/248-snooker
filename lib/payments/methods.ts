/**
 * Known checkout payment methods.
 * Mirrors the method ids in components/checkout/PaymentMethodList.tsx and the
 * whitelist in app/api/checkout/create/route.ts.
 * Kept out of the API route file — Next.js route modules may only export
 * HTTP verbs and route config.
 *
 * Display order here is the admin toggle order. The customer-facing order is
 * KPAY_METHODS in components/checkout/PaymentMethodList.tsx.
 */
export const PAYMENT_METHODS = [
  { method: 'card', label: '信用卡', sublabel: 'Visa · Mastercard · UnionPay' },
  { method: 'fps', label: '轉數快', sublabel: 'FPS · 60 秒內完成過數' },
  { method: 'payme', label: 'PayMe', sublabel: 'HSBC PayMe' },
  { method: 'octopus', label: '八達通', sublabel: 'Octopus' },
  { method: 'alipayhk', label: 'AlipayHK', sublabel: '香港支付寶錢包' },
  { method: 'alipay', label: '支付寶', sublabel: 'Alipay 中國內地帳戶' },
  { method: 'wechat', label: '微信支付', sublabel: 'WeChat Pay' },
  { method: 'unionpay_qp', label: '雲閃付', sublabel: 'UnionPay QuickPass' },
] as const

export type PaymentMethodId = (typeof PAYMENT_METHODS)[number]['method']

// ── KPay direct-connect rails ─────────────────────────────────────
// The only methods the KPay flow can start. Must stay identical to
// `KPayMethod` in components/checkout/KPayPayment.tsx and `ALLOWED_METHODS`
// in app/api/admin/payment-dev/kpay/route.ts — all three are the same set.
//
// Order is checkout display order (cards → HK wallets → mainland → UnionPay),
// matching the public KPay branch in app/[locale]/book/page.tsx.
export const KPAY_METHODS = [
  'card',
  'fps',
  'payme',
  'octopus',
  'alipay',
  'alipayhk',
  'wechat',
  'unionpay_qp',
] as const

export type KPayMethodId = (typeof KPAY_METHODS)[number]

export function isKPayMethodId(
  method: string | null | undefined,
): method is KPayMethodId {
  return typeof method === 'string' && (KPAY_METHODS as readonly string[]).includes(method)
}

export type KpaySelection = { method: KPayMethodId; mode: 'qr' | 'h5' }

/**
 * What KPayPayment must receive for a tapped rail.
 *
 * Returns null when the id is not a KPay rail. Callers must then refuse to
 * render KPayPayment — never substitute another method. The old
 * `kpayMethod ?? "fps"` fallback sent FPS when the selected rail never made it
 * into state, which is how a PayMe order could be created from an Octopus tap.
 */
export function kpaySelectionFor(
  method: string | null | undefined,
  isDesktop: boolean,
): KpaySelection | null {
  if (!isKPayMethodId(method)) return null
  return { method, mode: isDesktop ? 'qr' : 'h5' }
}

/**
 * Single source of truth for the KPay Stage 2 gate and for the `method` prop
 * handed to KPayPayment.
 *
 * Returns the method only when the tapped card is a KPay rail AND the method
 * state agrees with it. Otherwise null → the caller must render an error and
 * must not mount KPayPayment. That invariant is what makes it impossible for
 * KPay to receive a rail the operator did not select.
 */
export function kpayPaymentMethodFor(
  paymentMethod: string | null | undefined,
  kpayMethod: string | null | undefined,
): KPayMethodId | null {
  if (!isKPayMethodId(paymentMethod)) return null
  if (kpayMethod !== paymentMethod) return null
  return paymentMethod
}
