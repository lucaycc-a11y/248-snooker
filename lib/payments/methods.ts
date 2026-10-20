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
