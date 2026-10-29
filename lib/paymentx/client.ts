// ─────────────────────────────────────────────────────────────────
// PaymentXClient — KPay 全托管收銀台 (hosted cashier), merchant mode.
//
// Copied from the pattern in lib/payments/kpay.ts but kept separate on purpose: the live
// direct-connect flow must not change when PaymentX does. Same credentials, same
// proxy transport, same RSA-SHA256 signing.
//
// Flow: createManagedOrder → redirect the customer to the cashier URL → KPay shows the
// payment methods and may create several payment orders under the one managed order →
// we learn the result by querying the managed order (notify is only a trigger).
// ─────────────────────────────────────────────────────────────────

import crypto from 'node:crypto'
import { kpayProxyFetch } from '@/lib/kpay/proxyFetch'
import { getKPayEnv } from '@/lib/env/uat'
import { buildSignText, generateNonce, signText, toPem, verifySignature } from './sign'

const MIN_AMOUNT_HKD = 1.5
// 掃碼類訂單有效期（分鐘），KPay 允許 2–10。
const QR_ORDER_EXPIRE_MINUTES = 10

type ApiResponse<T> = { code: number; message?: string; data?: T }

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`PaymentX 未配置完成：缺少 ${name}`)
  return v
}

export type ManagedOrderState = 'pending' | 'paid' | 'expired' | 'refunded' | 'closed' | 'unknown'

export type ManagedPayment = {
  orderNo: string
  outTradeNo: string
  result: number
  orderState: number
  payAmount: number | null
}

export type ManagedOrderResult = {
  state: ManagedOrderState
  rawState: string
  managedOrderNo: string
  managedOutTradeNo: string
  payAmount: number | null
  /** KPay's payment-order number of the successful payment (needed for refunds in KPay backend). */
  paidOrderNo: string | null
  payments: ManagedPayment[]
}

export type CreateManagedOrderInput = {
  /** Our unique reference for this managed order (1–32 chars). */
  managedOutTradeNo: string
  amount: number
  itemName: string
  baseUrl: string
  returnUrl: string
  remark?: string
}

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v)
  return null
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : typeof v === 'number' ? String(v) : ''
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

export function mapManagedState(raw: unknown): ManagedOrderState {
  switch (String(raw)) {
    case '1':
      return 'pending'
    case '2':
      return 'paid'
    case '3':
      return 'expired'
    case '4':
      return 'refunded'
    case '5':
      return 'closed'
    default:
      return 'unknown'
  }
}

export class PaymentXClient {
  private readonly merchantCode: string
  private readonly privateKey: string
  private readonly platformPublicKey: string
  private readonly baseUrl: string

  constructor(hostname?: string) {
    this.merchantCode = requireEnv('KPAY_MERCHANT_CODE')
    this.privateKey = toPem(requireEnv('KPAY_PRIVATE_KEY'), 'PRIVATE KEY')
    this.platformPublicKey = toPem(requireEnv('KPAY_PLATFORM_PUBLIC_KEY'), 'PUBLIC KEY')
    this.baseUrl =
      getKPayEnv(hostname) === 'uat' ? 'https://payment.uat.kpay-group.com' : 'https://payment.kpay-group.com'
    try {
      crypto.createPublicKey(this.platformPublicKey)
    } catch (e) {
      throw new Error(`KPAY_PLATFORM_PUBLIC_KEY 格式錯誤：${(e as Error).message}`)
    }
  }

  // ── POST /v1/managed/order/add ─────────────────────────────────
  async createManagedOrder(input: CreateManagedOrderInput): Promise<{ managedOrderNo: string }> {
    if (!Number.isFinite(input.amount) || input.amount < MIN_AMOUNT_HKD) {
      throw new Error(`PaymentX 建單失敗：金額 HKD ${input.amount} 低於閘道最低限額 HKD ${MIN_AMOUNT_HKD}`)
    }
    if (input.managedOutTradeNo.length < 1 || input.managedOutTradeNo.length > 32) {
      throw new Error('PaymentX 建單失敗：managedOutTradeNo 長度必須 1–32')
    }
    const amount = input.amount.toFixed(2)
    const body: Record<string, unknown> = {
      managedOutTradeNo: input.managedOutTradeNo,
      payAmount: amount,
      payCurrency: 'HKD',
      notifyUrl: `${input.baseUrl}/api/webhooks/paymentx`,
      returnUrl: input.returnUrl,
      qrOrderExpireMinute: QR_ORDER_EXPIRE_MINUTES,
      itemList: [
        {
          itemNo: input.managedOutTradeNo,
          itemName: input.itemName.slice(0, 128),
          price: amount,
          priceCurrency: 'HKD',
          quantity: 1,
        },
      ],
      ...(input.remark ? { orderRemark: input.remark.slice(0, 255) } : {}),
    }
    const res = await this.post<ApiResponse<{ managedOrderNo: string }>>('/v1/managed/order/add', body)
    if (res.code !== 10000 || !res.data?.managedOrderNo) {
      throw new Error(`PaymentX 建單失敗：${res.message ?? '未知錯誤'} (code: ${res.code})`)
    }
    return { managedOrderNo: res.data.managedOrderNo }
  }

  // ── Signed redirect URL to the cashier page ────────────────────
  // web  → GET /v1/web/managed/order   (desktop)
  // h5   → GET /v1/h5/managed/order    (mobile)
  buildCashierUrl(managedOrderNo: string, mode: 'web' | 'h5'): string {
    const timestamp = Date.now().toString()
    const nonceStr = generateNonce()
    const base = mode === 'h5' ? '/v1/h5/managed/order' : '/v1/web/managed/order'
    const path =
      `${base}?managedOrderNo=${encodeURIComponent(managedOrderNo)}` +
      `&language=zh_HK` +
      `&K-Merchant-Code=${encodeURIComponent(this.merchantCode)}` +
      `&K-Nonce-Str=${encodeURIComponent(nonceStr)}` +
      `&K-Timestamp=${encodeURIComponent(timestamp)}`
    const text = buildSignText('GET', path, timestamp, nonceStr, this.merchantCode, '')
    const signature = signText(this.privateKey, text)
    return `${this.baseUrl}${path}&K-Signature=${encodeURIComponent(signature)}`
  }

  // ── GET /v1/managed/order/result ───────────────────────────────
  async queryManagedOrder(ref: { managedOrderNo?: string; managedOutTradeNo?: string }): Promise<ManagedOrderResult> {
    const q = ref.managedOrderNo
      ? `managedOrderNo=${encodeURIComponent(ref.managedOrderNo)}`
      : `managedOutTradeNo=${encodeURIComponent(ref.managedOutTradeNo ?? '')}`
    const path = `/v1/managed/order/result?${q}`

    type Data = Record<string, unknown>
    let res: ApiResponse<Data>
    try {
      res = await this.get<ApiResponse<Data>>(path)
    } catch (first) {
      // GET is idempotent: one retry on a network hiccup / timeout / 5xx.
      if (!/timeout|fetch failed|ECONN|ETIMEDOUT|HTTP 5\d\d/i.test((first as Error).message)) throw first
      res = await this.get<ApiResponse<Data>>(path)
    }
    if (res.code !== 10000 || !isRecord(res.data)) {
      throw new Error(`PaymentX 查詢失敗：${res.message ?? '未知錯誤'} (code: ${res.code})`)
    }
    const d = res.data
    const list = Array.isArray(d.paymentOrderList) ? d.paymentOrderList : []
    const payments: ManagedPayment[] = list.filter(isRecord).map((p) => ({
      orderNo: str(p.orderNo),
      outTradeNo: str(p.outTradeNo),
      result: num(p.result) ?? 0,
      orderState: num(p.orderState) ?? 0,
      payAmount: num(p.payAmount) ?? num(p.localPayAmount),
    }))
    const paid = payments.find((p) => p.result === 2)
    const state = mapManagedState(d.managedOrderState)
    return {
      state,
      rawState: String(d.managedOrderState ?? ''),
      managedOrderNo: str(d.managedOrderNo),
      managedOutTradeNo: str(d.managedOutTradeNo),
      payAmount: num(d.payAmount) ?? num(d.localPayAmount),
      paidOrderNo: paid?.orderNo || null,
      payments,
    }
  }

  // ── Notify signature ───────────────────────────────────────────
  // KPay signs the callback with the path of our notifyUrl. The live webhook verifies
  // against '/api/webhooks/kpay'; accept either that or this route's own path.
  verifyNotify(
    rawBody: string,
    headers: { timestamp: string; nonceStr: string; merchantCode: string; signature: string },
    requestPath: string,
  ): boolean {
    const paths = Array.from(new Set([requestPath, '/api/webhooks/paymentx', '/api/webhooks/kpay']))
    return paths.some((p) => verifySignature(rawBody, headers, this.platformPublicKey, p))
  }

  get merchant(): string {
    return this.merchantCode
  }

  // ── Transport ──────────────────────────────────────────────────
  private async post<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const timestamp = Date.now().toString()
    const nonceStr = generateNonce()
    const bodyStr = JSON.stringify(body)
    const signature = signText(
      this.privateKey,
      buildSignText('POST', path, timestamp, nonceStr, this.merchantCode, bodyStr),
    )
    const res = await kpayProxyFetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: this.headers(timestamp, nonceStr, signature),
      body: bodyStr,
    })
    return this.parse<T>(res, path)
  }

  private async get<T>(path: string): Promise<T> {
    const timestamp = Date.now().toString()
    const nonceStr = generateNonce()
    const signature = signText(
      this.privateKey,
      buildSignText('GET', path, timestamp, nonceStr, this.merchantCode, ''),
    )
    const res = await kpayProxyFetch(`${this.baseUrl}${path}`, {
      method: 'GET',
      headers: this.headers(timestamp, nonceStr, signature),
    })
    return this.parse<T>(res, path)
  }

  private headers(timestamp: string, nonceStr: string, signature: string): Record<string, string> {
    return {
      'K-Merchant-Code': this.merchantCode,
      'K-Nonce-Str': nonceStr,
      'K-Signature': signature,
      'K-Timestamp': timestamp,
      'K-Language': 'zh_HK',
      'content-type': 'application/json;charset=UTF-8',
    }
  }

  private async parse<T>(res: Response, path: string): Promise<T> {
    const text = await res.text()
    let json: unknown
    try {
      json = JSON.parse(text)
    } catch {
      throw new Error(`PaymentX API 回應非 JSON (HTTP ${res.status}) ${path}: ${text.slice(0, 160)}`)
    }
    if (!res.ok) {
      const code = isRecord(json) ? json.code : undefined
      const message = isRecord(json) ? json.message : undefined
      throw new Error(`PaymentX API HTTP ${res.status}${code ? ` (code ${String(code)})` : ''}: ${String(message ?? res.statusText)}`)
    }
    return json as T
  }
}
