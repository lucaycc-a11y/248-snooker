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
import { buildSignText, signKpay, generateNonce, toPem } from './kpay-sign'
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
    this.privateKey = toPem(requireEnv('KPAY_PRIVATE_KEY'), 'PRIVATE KEY')
    this.platformPublicKey = toPem(requireEnv('KPAY_PLATFORM_PUBLIC_KEY'), 'PUBLIC KEY')
    this.baseUrl = getKpayBaseUrl()

    // Validate key formats at startup so misconfigured keys fail loudly on
    // cold-start rather than silently at the first payment request.
    try {
      const signer = crypto.createSign('RSA-SHA256')
      signer.update('self-test', 'utf8')
      signer.end()
      signer.sign(this.privateKey)
    } catch (e) {
      throw new Error(`KPAY_PRIVATE_KEY 格式錯誤，parse 唔到：${(e as Error).message}`)
    }

    try {
      crypto.createPublicKey(this.platformPublicKey)
    } catch (e) {
      throw new Error(`KPAY_PLATFORM_PUBLIC_KEY 格式錯誤，parse 唔到：${(e as Error).message}`)
    }
  }

  // ── createOrder ──────────────────────────────────────────────

  async createOrder(params: CreateOrderParams): Promise<CreateOrderResult> {
    const { outTradeNo, amount, method, mode, remark, baseUrl } = params

    // ── Credit card: CNP Hosted (redirect to KPay's card entry page) ──────
    // KPay requires their own PCI-compliant page for card number input +
    // 3DS. We create the order with CNP_SALES_GATEWAY, then build a signed
    // H5 URL that redirects the user to KPay's hosted checkout.
    if (method === 'card') {
      return this.createCnpHostedOrder(outTradeNo, amount, remark, baseUrl)
    }

    // ── Direct-connect methods (FPS / PayMe / Octopus / wallets) ──────────
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
    const institution = this.getPaymentInstitution(method)
    const qrBody: Record<string, unknown> = {
      outTradeNo,
      payAmount: amount.toFixed(2),
      payCurrency: 'HKD',
      notifyUrl: `${baseUrl}/api/webhooks/kpay`,
      ...(institution ? { paymentInstitution: institution } : {}),
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

  // ── CNP Hosted (credit card) ────────────────────────────────────────────

  private async createCnpHostedOrder(
    outTradeNo: string,
    amount: number,
    remark: string | undefined,
    baseUrl: string,
  ): Promise<CreateOrderResult> {
    // Step 1: create order with CNP_SALES_GATEWAY type
    const orderBody = {
      outTradeNo,
      orderType: 'CNP_SALES_GATEWAY',
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

    const orderNo = orderRes.data!.orderNo

    // Step 2: build signed H5 redirect URL for KPay's hosted card page
    const timestamp = Date.now().toString()
    const nonceStr = generateNonce()
    const h5Path = `/v1/h5?orderNo=${encodeURIComponent(orderNo)}&language=zh_HK&K-Merchant-Code=${encodeURIComponent(this.merchantCode)}&K-Nonce-Str=${encodeURIComponent(nonceStr)}&K-Timestamp=${encodeURIComponent(timestamp)}`

    const signText = buildSignText('GET', h5Path, timestamp, nonceStr, this.merchantCode, '')
    const signature = signKpay(this.privateKey, signText)

    const redirectUrl = `${this.baseUrl}${h5Path}&K-Signature=${encodeURIComponent(signature)}`

    return {
      providerOrderNo: orderNo,
      payInfo: redirectUrl,
      kind: 'redirect',
      expiresInSeconds: 1800, // 30 minutes for credit card
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
      fps:          { qr: 'FPS_SALE_QR',       h5: 'FPS_SALE_H5'       },
      payme:        { qr: 'PAYME_SALE_QR',     h5: 'PAYME_SALE_H5'     },
      octopus:      { qr: 'OCTOPUS_SALE_QR',   h5: 'OCTOPUS_SALE_H5'   },
      alipay:       { qr: 'ALIPAY_SALE_QR',    h5: 'ALIPAY_SALE_H5'    },
      alipayhk:     { qr: 'ALIPAY_SALE_QR',    h5: 'ALIPAY_SALE_H5'    },
      wechat:       { qr: 'WXPAY_SALE_QR',     h5: 'WXPAY_SALE_H5'     },
      unionpay_qp:  { qr: 'UNIONPAY_SALE_QR',  h5: 'UNIONPAY_SALE_QR'  },
    }
    return map[method]?.[mode] ?? 'FPS_SALE_H5'
  }

  private getQrEndpoint(method: string, mode: 'qr' | 'h5'): string {
    const map: Record<string, { qr: string; h5: string }> = {
      fps:          { qr: '/v1/qr/sales/scan/fps',      h5: '/v1/qr/sales/h5/fps'      },
      payme:        { qr: '/v1/qr/sales/scan/payme',    h5: '/v1/qr/sales/h5/payme'    },
      octopus:      { qr: '/v1/qr/sales/scan/octopus',  h5: '/v1/qr/sales/h5/octopus'  },
      alipay:       { qr: '/v1/qr/sales/scan/alipay',   h5: '/v1/qr/sales/h5/alipay'   },
      alipayhk:     { qr: '/v1/qr/sales/scan/alipay',   h5: '/v1/qr/sales/h5/alipay'   },
      wechat:       { qr: '/v1/qr/sales/scan/wxpay',    h5: '/v1/qr/sales/h5/wxpay'    },
      unionpay_qp:  { qr: '/v1/qr/sales/scan/unionpay', h5: '/v1/qr/sales/scan/unionpay' },
    }
    return map[method]?.[mode] ?? '/v1/qr/sales/h5/fps'
  }

  /**
   * For Alipay CN vs HK, KPay uses the same endpoint but distinguishes
   * via paymentInstitution in the request body. Returns undefined for
   * methods that don't need it.
   */
  private getPaymentInstitution(method: string): string | undefined {
    if (method === 'alipay') return 'ALIPAYCN'
    if (method === 'alipayhk') return 'ALIPAYHK'
    return undefined
  }

  private getExpiresInSeconds(method: string): number {
    if (method === 'fps') return 60
    return 600
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