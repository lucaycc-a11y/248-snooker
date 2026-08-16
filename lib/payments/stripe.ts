// ─────────────────────────────────────────────────────────────────
// StripeProvider — wraps the existing Stripe PaymentIntent flow
// behind the PaymentProvider interface.  No behavioural change to
// the existing Stripe checkout path.
// ─────────────────────────────────────────────────────────────────

import type Stripe from 'stripe'
import { getStripe } from '@/lib/stripe/server'
import type {
  PaymentProvider,
  CreateOrderParams,
  CreateOrderResult,
  OrderStatus,
  RefundParams,
  RefundResult,
  WebhookEvent,
} from './types'

export class StripeProvider implements PaymentProvider {
  readonly name = 'stripe'

  async createOrder(params: CreateOrderParams): Promise<CreateOrderResult> {
    const stripe = getStripe()
    const amountInCents = Math.round(params.amount * 100)
    const intent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'hkd',
      automatic_payment_methods: { enabled: true },
      metadata: {
        out_trade_no: params.outTradeNo,
      },
    })
    return {
      providerOrderNo: intent.id,
      payInfo: intent.client_secret ?? '',
      kind: 'redirect',
      expiresInSeconds: 1800, // 30 min default Stripe expiry
    }
  }

  async queryOrder(providerOrderNo: string): Promise<OrderStatus> {
    const stripe = getStripe()
    const pi = await stripe.paymentIntents.retrieve(providerOrderNo)
    return {
      providerOrderNo: pi.id,
      status: mapStripeStatus(pi.status),
      rawStatus: pi.status,
    }
  }

  async refund(params: RefundParams): Promise<RefundResult> {
    const stripe = getStripe()
    try {
      const refund = await stripe.refunds.create({
        payment_intent: params.providerOrderNo,
        amount: Math.round(params.amount * 100),
      })
      return {
        success: true,
        providerRefundNo: refund.id,
      }
    } catch (err) {
      const e = err as { message?: string }
      return { success: false, message: e.message ?? 'Refund failed' }
    }
  }

  verifyWebhookSignature(_rawBody: string, headers: Record<string, string>): boolean {
    // Stripe signature verification is done by the Stripe SDK's
    // constructEvent() — we delegate to that in the route handler.
    // This method is a no-op for Stripe.
    return true
  }

  parseWebhookPayload(rawBody: string): WebhookEvent {
    const event = JSON.parse(rawBody) as Stripe.Event
    const obj = event.data.object as Stripe.PaymentIntent & { out_trade_no?: string }
    return {
      eventType: event.type,
      providerOrderNo: obj.id,
      outTradeNo: obj.metadata?.out_trade_no,
      status: mapWebhookEventType(event.type),
      rawPayload: event as unknown as Record<string, unknown>,
    }
  }
}

function mapStripeStatus(status: string): OrderStatus['status'] {
  switch (status) {
    case 'succeeded':
    case 'processing':
      return 'success'
    case 'requires_payment_method':
    case 'requires_confirmation':
    case 'requires_action':
    case 'canceled':
      return 'cancelled'
    default:
      return 'pending'
  }
}

function mapWebhookEventType(type: string): WebhookEvent['status'] {
  if (type === 'payment_intent.succeeded') return 'succeeded'
  if (type === 'payment_intent.payment_failed') return 'failed'
  if (type === 'charge.refunded') return 'refunded'
  return 'succeeded'
}