// ─────────────────────────────────────────────────────────────────
// Shared payment-provider interface — every provider (Stripe, KPay)
// implements this contract so the checkout flow is provider-agnostic.
// ─────────────────────────────────────────────────────────────────

export type PaymentMethod =
  | 'card'
  | 'apple_pay'
  | 'google_pay'
  | 'fps'
  | 'payme'
  | 'octopus'
  | 'alipay'
  | 'alipayhk'
  | 'wechat'
  | 'unionpay_qp'

export type PayInfoKind = 'qr' | 'link' | 'redirect'

export type KPayOrderType =
  | 'FPS_SALE_QR'
  | 'FPS_SALE_H5'
  | 'PAYME_SALE_QR'
  | 'PAYME_SALE_H5'
  | 'OCTOPUS_SALE_QR'
  | 'OCTOPUS_SALE_H5'
  | 'ALIPAY_SALE_QR'
  | 'ALIPAY_SALE_H5'
  | 'WXPAY_SALE_QR'
  | 'WXPAY_SALE_H5'
  | 'UNIONPAY_SALE_QR'

/** Map a PaymentMethod to the KPay orderType (QR vs H5 variant). */
export function getKPayOrderType(method: PaymentMethod, mode: 'qr' | 'h5'): KPayOrderType {
  const map: Record<string, { qr: KPayOrderType; h5: KPayOrderType }> = {
    fps:          { qr: 'FPS_SALE_QR',       h5: 'FPS_SALE_H5'       },
    payme:        { qr: 'PAYME_SALE_QR',     h5: 'PAYME_SALE_H5'     },
    octopus:      { qr: 'OCTOPUS_SALE_QR',   h5: 'OCTOPUS_SALE_H5'   },
    alipay:       { qr: 'ALIPAY_SALE_QR',    h5: 'ALIPAY_SALE_H5'    },
    alipayhk:     { qr: 'ALIPAY_SALE_QR',    h5: 'ALIPAY_SALE_H5'    },
    wechat:       { qr: 'WXPAY_SALE_QR',     h5: 'WXPAY_SALE_H5'     },
    unionpay_qp:  { qr: 'UNIONPAY_SALE_QR',  h5: 'UNIONPAY_SALE_QR'  }, // QR only
    card:         { qr: 'FPS_SALE_QR',       h5: 'FPS_SALE_H5'       }, // fallback
    apple_pay:    { qr: 'FPS_SALE_QR',       h5: 'FPS_SALE_H5'       },
    google_pay:   { qr: 'FPS_SALE_QR',       h5: 'FPS_SALE_H5'       },
  }
  return map[method]?.[mode] ?? 'FPS_SALE_H5'
}

/** Expiry (seconds) per KPay payment method. FPS = 60s, all others = 600s. */
export function kpayExpiresInSeconds(method: PaymentMethod): number {
  if (method === 'fps') return 60
  return 600
}

export interface CreateOrderParams {
  /** Space8 human-readable booking code (outTradeNo). */
  outTradeNo: string
  /** Amount in HKD (not cents). */
  amount: number
  /** The payment method the user chose. */
  method: PaymentMethod
  /** Whether to produce a QR code or a redirect link. */
  mode: 'qr' | 'h5'
  /** Optional remark (table / time slot). */
  remark?: string
  /** Base URL for the webhook + return URLs. */
  baseUrl: string
}

export interface CreateOrderResult {
  providerOrderNo: string
  payInfo: string          // QR content string or redirect URL
  kind: PayInfoKind
  expiresInSeconds: number
}

export interface OrderStatus {
  status: 'pending' | 'success' | 'failed' | 'refunded' | 'cancelled' | 'closed'
  providerOrderNo: string
  rawStatus: string
}

export interface RefundParams {
  providerOrderNo: string
  amount: number
  reason?: string
}

export interface RefundResult {
  success: boolean
  providerRefundNo?: string
  message?: string
}

export interface WebhookEvent {
  eventType: string
  providerOrderNo: string
  outTradeNo?: string
  status: 'succeeded' | 'failed' | 'refunded'
  rawPayload: Record<string, unknown>
}

export interface PaymentProvider {
  createOrder(params: CreateOrderParams): Promise<CreateOrderResult>
  queryOrder(providerOrderNo: string): Promise<OrderStatus>
  refund(params: RefundParams): Promise<RefundResult>
  verifyWebhookSignature(rawBody: string, headers: Record<string, string>): boolean
  parseWebhookPayload(rawBody: string): WebhookEvent
}

// ── KPay-specific error codes ──────────────────────────────────

export const KPAY_ERROR_MESSAGES: Record<string, string> = {
  '40002': '簽名無效 —— 檢查簽名串構造/私鑰',
  '40009': '時間戳超出限制 —— 檢查伺服器時間同步',
  '1006':  '原訂單不存在',
  '1034':  '支付金額不匹配',
  '1047':  '無效金額',
  '29529': '二維碼已過期',
  '29523': '退貨金額不能大於商戶當日交易金額',
}

export function kpayErrorMessage(code: string): string {
  return KPAY_ERROR_MESSAGES[code] ?? `KPay 錯誤 (${code})`
}