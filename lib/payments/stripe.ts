// ─────────────────────────────────────────────────────────────────
// StripeProvider — Stripe PaymentIntents integration supporting
// Card, Alipay, Google Pay, Apple Pay, WeChat Pay.
// ─────────────────────────────────────────────────────────────────

import type {
  PaymentProvider,
  PaymentMethod,
  PayInfoKind,
  CreateOrderParams,
  CreateOrderResult,
  OrderStatus,
  RefundParams,
  RefundResult,
  WebhookEvent,
} from './types'

// ── Env accessors ──────────────────────────────────────────────

function requireEnv(name: string): string {
  const val = process.env[name]
  if (!val) {
    throw new Error(`Stripe 未配置完成：缺少 ${name}`)
  }
  return val
}

// ── StripeProvider ────────────────────────────────────────────

export class StripeProvider implements PaymentProvider {
  readonly name = 'stripe'
  private readonly stripe: any

  constructor() {
    const secretKey = requireEnv('STRIPE_SECRET_KEY')
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Stripe = require('stripe')
    this.stripe = new Stripe(secretKey, {
      apiVersion: '2026-06-24.dahlia',
      typescript: true,
    })
  }

  // ── createOrder ────────────────────────────────────────────

  async createOrder(params: CreateOrderParams): Promise<CreateOrderResult> {
    const { outTradeNo, bookingId, amount, method, remark } = params

    // Map our method IDs to Stripe payment_method_types
    const paymentMethodTypes: string[] = []
    if (method === 'card' || method === 'google_pay' || method === 'apple_pay') {
      paymentMethodTypes.push('card')
    } else if (method === 'alipay' || method === 'alipayhk') {
      paymentMethodTypes.push('alipay')
    } else if (method === 'wechat_pay') {
      paymentMethodTypes.push('wechat_pay')
    }

    const createParams: any = {
      amount: Math.round(amount * 100), // Convert HKD to cents
      currency: 'hkd',
      payment_method_types: paymentMethodTypes,
      metadata: {
        booking_id: bookingId,
        out_trade_no: outTradeNo,
        remark: remark || '',
      },
    }

    // WeChat Pay requires explicit client parameter
    if (method === 'wechat_pay') {
      createParams.payment_method_options = {
        wechat_pay: {
          client: 'web',
        },
      }
    }

    const intent = await this.stripe.paymentIntents.create(createParams)

    if (!intent.client_secret) {
      throw new Error('Stripe PaymentIntent 建立失敗：缺少 client_secret')
    }

    return {
      providerOrderNo: intent.id,
      payInfo: intent.client_secret,
      kind: 'client_secret' as PayInfoKind,
      expiresInSeconds: 3600, // Stripe PaymentIntents don't auto-expire, set reasonable timeout
    }
  }

  // ── queryOrder ─────────────────────────────────────────────

  async queryOrder(providerOrderNo: string): Promise<OrderStatus> {
    const intent = await this.stripe.paymentIntents.retrieve(providerOrderNo)
    const status = this.mapStripeStatus(intent.status)

    return {
      status,
      providerOrderNo: intent.id,
      rawStatus: intent.status,
      failureCode: intent.last_payment_error?.code ?? undefined,
      failureReason: intent.last_payment_error?.message ?? undefined,
    }
  }

  // ── refund ─────────────────────────────────────────────────

  async refund(params: RefundParams): Promise<RefundResult> {
    const { providerOrderNo, amount, reason } = params

    const refund = await this.stripe.refunds.create({
      payment_intent: providerOrderNo,
      amount: Math.round(amount * 100),
      reason: reason === 'user_cancel' ? 'requested_by_customer' : undefined,
      metadata: {
        reason: reason || '',
      },
    })

    return {
      success: refund.status === 'succeeded' || refund.status === 'pending',
      providerRefundNo: refund.id,
      message: refund.status,
    }
  }

  // ── verifyWebhookSignature ────────────────────────────────

  verifyWebhookSignature(rawBody: string, headers: Record<string, string>): boolean {
    const webhookSecret = requireEnv('STRIPE_WEBHOOK_SECRET')
    const signature = headers['stripe-signature']
    if (!signature) return false

    try {
      this.stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
      return true
    } catch {
      return false
    }
  }

  // ── parseWebhookPayload ───────────────────────────────────

  parseWebhookPayload(rawBody: string): WebhookEvent {
    const webhookSecret = requireEnv('STRIPE_WEBHOOK_SECRET')
    const signature = process.env.STRIPE_WEBHOOK_SIGNATURE || ''
    const event = this.stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)

    let status: 'succeeded' | 'failed' | 'refunded' = 'failed'
    let providerOrderNo = ''
    let outTradeNo: string | undefined

    if (event.type === 'payment_intent.succeeded') {
      const intent = event.data.object as any
      status = 'succeeded'
      providerOrderNo = intent.id
      outTradeNo = intent.metadata.out_trade_no
    } else if (event.type === 'payment_intent.payment_failed') {
      const intent = event.data.object as any
      status = 'failed'
      providerOrderNo = intent.id
      outTradeNo = intent.metadata.out_trade_no
    } else if (event.type === 'charge.refunded') {
      const charge = event.data.object as any
      status = 'refunded'
      providerOrderNo = charge.payment_intent as string
    }

    return {
      eventType: event.type,
      providerOrderNo,
      outTradeNo,
      status,
      rawPayload: event.data.object as unknown as Record<string, unknown>,
    }
  }

  // ── Helper: map Stripe status to our OrderStatus ──────────

  private mapStripeStatus(stripeStatus: string): OrderStatus['status'] {
    switch (stripeStatus) {
      case 'succeeded':
        return 'success'
      case 'processing':
        return 'pending'
      case 'requires_payment_method':
      case 'requires_confirmation':
      case 'requires_action':
      case 'requires_capture':
        return 'pending'
      case 'canceled':
        return 'cancelled'
      default:
        return 'failed'
    }
  }
}
