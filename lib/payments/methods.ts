/**
 * Known checkout payment methods.
 * Mirrors the method ids in components/checkout/StripeMethodSelector.tsx.
 * Kept out of the API route file — Next.js route modules may only export
 * HTTP verbs and route config.
 */
export const PAYMENT_METHODS = [
  { method: 'card', label: '信用卡', sublabel: 'Visa · Mastercard · UnionPay' },
  { method: 'alipay', label: '支付宝', sublabel: 'Alipay HK' },
  { method: 'alipay_cn', label: '支付寶', sublabel: 'Alipay 中國內地帳戶' },
  { method: 'google_pay', label: 'Google Pay', sublabel: '' },
  { method: 'apple_pay', label: 'Apple Pay', sublabel: '' },
  { method: 'wechat_pay', label: '微信支付', sublabel: 'WeChat Pay' },
] as const

export type PaymentMethodId = (typeof PAYMENT_METHODS)[number]['method']
