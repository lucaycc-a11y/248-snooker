// ─────────────────────────────────────────────────────────────────
// KPayProvider — merchant-mode, direct-connect KPay integration.
// Throws with clear messages when env vars are missing.
// ─────────────────────────────────────────────────────────────────

import crypto from 'node:crypto'
import type {
  PaymentProvider,
  CreateOrderParams,
  CreateOrderResult,
  OrderStatus,
  RefundParams,
  RefundResult,
  WebhookEvent,
} from './types'
import { buildSignText, signKpay, generateNonce } from './kpay-sign'
import { kpayErrorMessage } from './types'

// ── Env accessors (throw early on missing config) ─────────────

function requireEnv(name: string): string {
  const val = process.env[name]
  if (!val) {
    throw new Error(`KPay 未配置完成：缺少 ${name}`)
  }
  return val
}

function getKpayBaseUrl(): string {
  const env = process.env.KPAY_ENV ?? 'uat'
  if (env === 'prod') return 'https://payment.kpay-group.com'
  return 'https://payment.uat.kpay-group.com'
}

// ── KPay API response type ────────────────────────────────────

type KPayApiResponse<T> = {
  code: number
  message?: string
  data?: T
}

// ── KPayProvider ──────────────────────────────────────────────

export class KPayProvider implements PaymentProvider {
  readonly name = 'kpay'

  private readonly merchantCode: string
  private readonly privateKey: string
  private readonly platformPublicKey: string
  private readonly baseUrl: string

  constructor() {
    this.merchantCode = requireEnv('KPAY_MERCHANT_CODE')
    this.privateKey = requireEnv('KPAY_PRIVATE_KEY')
    this.platformPublicKey = requireEnv('KPAY_PLATFORM_PUBLIC_KEY')
    this.baseUrl = getKpayBaseUrl()
  }

  // ── createOrder ──────────────────────────────────────────────

  async createOrder(params: CreateOrderParams): Promise<CreateOrderResult> {
    const { outTradeNo, amount, method, mode, remark, baseUrl } = params

    // Step 1: create the trade order
    const orderBody = {
      outTradeNo,
      orderType: this.getOrderType(method, mode),
      payAmount: amount.toFixed(2),
      payCurrency: 'HKD',
      notifyUrl: `${baseUrl}/api/webhooks/kpay`,
      returnUrl: `${baseUrl}/book/confirmation?orderNo=${outTradeNo}`,
      ...(remark ? { orderRemark: remark } : {}),
    }

    const orderRes = await this.apiPost<KPayApiResponse<{ orderNo: string }>>(
      '/v1/order/add',
      orderBody,
    )

    if (orderRes.code !== 10000) {
      throw new Error(`KPay 建單失敗：${orderRes.message ?? kpayErrorMessage(String(orderRes.code))}`)
    }

    const providerOrderNo = orderRes.data!.orderNo

    // Step 2: get the QR code or H5 link
    const qrBody = {
      outTradeNo,
      payAmount: amount.toFixed(2),
      payCurrency: 'HKD',
      notifyUrl: `${baseUrl}/api/webhooks/kpay`,
    }

    const qrEndpoint = this.getQrEndpoint(method, mode)
    const qrRes = await this.apiPost<KPayApiResponse<{ orderNo: string; payInfo: string }>>(
      qrEndpoint,
      qrBody,
    )

    if (qrRes.code !== 10000) {
      throw new Error(`KPay 取碼失敗：${qrRes.message ?? kpayErrorMessage(String(qrRes.code))}`)
    }

    const expiresInSeconds = this.getExpiresInSeconds(method)

    return {
      providerOrderNo,
      payInfo: qrRes.data!.payInfo,
      kind: mode === 'qr' ? 'qr' : 'link',
      expiresInSeconds,
    }
  }

  // ── queryOrder ───────────────────────────────────────────────

  async queryOrder(providerOrderNo: string): Promise<OrderStatus> {
    const res = await this.apiGet<KPayApiResponse<{
      orderNo: string
      outTradeNo: string
      result: string
    }>>(`/v1/order/sales/result?outTradeNo=${encodeURIComponent(providerOrderNo)}`)

    if (res.code !== 10000) {
      throw new Error(`KPay 查詢失敗：${res.message ?? kpayErrorMessage(String(res.code))}`)
    }

    const result = res.data!.result
    return {
      providerOrderNo: res.data!.orderNo,
      status: this.mapKPayResult(result),
      rawStatus: result,
    }
  }

  // ── refund ───────────────────────────────────────────────────

  async refund(params: RefundParams): Promise<RefundResult> {
    const body = {
      oriOrderNo: params.providerOrderNo,
      refundAmount: params.amount.toFixed(2),
      refundCurrency: 'HKD',
      ...(params.reason ? { refundReason: params.reason } : {}),
    }

    try {
      const res = await this.apiPost<KPayApiResponse<{ refundNo: string }>>('/v1/refund', body)
      if (res.code !== 10000) {
        return {
          success: false,
          message: `KPay 退款失敗：${res.message ?? kpayErrorMessage(String(res.code))}`,
        }
      }
      return {
        success: true,
        providerRefundNo: res.data?.refundNo,
      }
    } catch (err) {
      const e = err as Error
      return { success: false, message: e.message }
    }
  }

  // ── verifyWebhookSignature ───────────────────────────────────

  verifyWebhookSignature(rawBody: string, headers: Record<string, string>): boolean {
    const timestamp = headers['k-timestamp']
    const nonceStr = headers['k-nonce-str']
    const merchantCode = headers['k-merchant-code']
    const signature = headers['k-signature']

    if (!timestamp || !nonceStr || !merchantCode || !signature) {
      console.error('[kpay/webhook] missing required headers', {
        hasTimestamp: !!timestamp,
        hasNonce: !!nonceStr,
        hasMerchantCode: !!merchantCode,
        hasSignature: !!signature,
      })
      return false
    }

    const signText = buildSignText(
      'POST',
      '/api/webhooks/kpay',
      timestamp,
      nonceStr,
      merchantCode,
      rawBody,
    )

    try {
      const verifier = crypto.createVerify('RSA-SHA256')
      verifier.update(signText, 'utf8')
      verifier.end()
      return verifier.verify(this.platformPublicKey, signature, 'base64')
    } catch (err) {
      console.error('[kpay/webhook] verify error', (err as Error).message)
      return false
    }
  }

  // ── parseWebhookPayload ──────────────────────────────────────

  parseWebhookPayload(rawBody: string): WebhookEvent {
    const payload = JSON.parse(rawBody) as Record<string, unknown>
    const orderNo = String(payload.orderNo ?? payload.order_no ?? '')
    const outTradeNo = String(payload.outTradeNo ?? payload.out_trade_no ?? '')
    const status = String(payload.status ?? payload.tradeStatus ?? '')
    const eventType = String(payload.eventType ?? payload.event_type ?? 'payment.update')

    let mappedStatus: WebhookEvent['status']
    if (status === 'SUCCESS' || status === '2') {
      mappedStatus = 'succeeded'
    } else if (status === 'FAIL' || status === '3') {
      mappedStatus = 'failed'
    } else if (status === '4' || status === 'REFUND') {
      mappedStatus = 'refunded'
    } else {
      mappedStatus = 'succeeded'
    }

    return {
      eventType,
      providerOrderNo: orderNo,
      outTradeNo,
      status: mappedStatus,
      rawPayload: payload,
    }
  }

  // ── Private helpers ──────────────────────────────────────────

  private getOrderType(method: string, mode: 'qr' | 'h5'): string {
    const map: Record<string, { qr: string; h5: string }> = {
      fps:     { qr: 'FPS_SALE_QR',     h5: 'FPS_SALE_H5'     },
      payme:   { qr: 'PAYME_SALE_QR',   h5: 'PAYME_SALE_H5'   },
      octopus: { qr: 'OCTOPUS_SALE_QR', h5: 'OCTOPUS_SALE_H5' },
    }
    return map[method]?.[mode] ?? 'FPS_SALE_H5'
  }

  private getQrEndpoint(method: string, mode: 'qr' | 'h5'): string {
    const map: Record<string, { qr: string; h5: string }> = {
      fps:     { qr: '/v1/qr/sales/scan/fps',     h5: '/v1/qr/sales/h5/fps'     },
      payme:   { qr: '/v1/qr/sales/scan/payme',   h5: '/v1/qr/sales/h5/payme'   },
      octopus: { qr: '/v1/qr/sales/scan/octopus', h5: '/v1/qr/sales/h5/octopus' },
    }
    return map[method]?.[mode] ?? '/v1/qr/sales/h5/fps'
  }

  private getExpiresInSeconds(method: string): number {
    if (method === 'fps') return 60
    return 600 // payme / octopus
  }

  private async apiPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const timestamp = Date.now().toString()
    const nonceStr = generateNonce()
    const bodyStr = JSON.stringify(body)
    const signText = buildSignText('POST', path, timestamp, nonceStr, this.merchantCode, bodyStr)
    const signature = signKpay(this.privateKey, signText)

    const url = `${this.baseUrl}${path}`
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'K-Merchant-Code': this.merchantCode,
        'K-Nonce-Str': nonceStr,
        'K-Signature': signature,
        'K-Timestamp': timestamp,
        'K-Language': 'zh_HK',
        'content-type': 'application/json;charset=UTF-8',
      },
      body: bodyStr,
    })

    const text = await res.text()
    let json: T
    try {
      json = JSON.parse(text)
    } catch {
      throw new Error(`KPay API 回應非 JSON: ${text.slice(0, 200)}`)
    }

    if (!res.ok) {
      const code = (json as { code?: number })?.code
      const message = (json as { message?: string })?.message
      const detail = code
        ? `KPay API 錯誤 (${code}): ${message ?? kpayErrorMessage(String(code))}`
        : `KPay API HTTP ${res.status}`
      throw new Error(detail)
    }

    return json
  }

  private async apiGet<T>(path: string): Promise<T> {
    const timestamp = Date.now().toString()
    const nonceStr = generateNonce()
    const bodyStr = ''
    const signText = buildSignText('GET', path, timestamp, nonceStr, this.merchantCode, bodyStr)
    const signature = signKpay(this.privateKey, signText)

    const url = `${this.baseUrl}${path}`
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'K-Merchant-Code': this.merchantCode,
        'K-Nonce-Str': nonceStr,
        'K-Signature': signature,
        'K-Timestamp': timestamp,
        'K-Language': 'zh_HK',
        'content-type': 'application/json;charset=UTF-8',
      },
    })

    const text = await res.text()
    let json: T
    try {
      json = JSON.parse(text)
    } catch {
      throw new Error(`KPay API 回應非 JSON: ${text.slice(0, 200)}`)
    }

    if (!res.ok) {
      const code = (json as { code?: number })?.code
      const message = (json as { message?: string })?.message
      const detail = code
        ? `KPay API 錯誤 (${code}): ${message ?? kpayErrorMessage(String(code))}`
        : `KPay API HTTP ${res.status}`
      throw new Error(detail)
    }

    return json
  }

  private mapKPayResult(result: string): OrderStatus['status'] {
    switch (result) {
      case '2': return 'success'
      case '3': return 'failed'
      case '4': return 'refunded'
      case '5': return 'cancelled'
      case '6': return 'closed'
      default:  return 'pending' // '1' = pending
    }
  }
}