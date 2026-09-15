import { NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe/server'

export const runtime = 'nodejs'

// GET /api/payment/available-methods
// Queries Stripe account to determine which payment methods are actually
// enabled and configured. Returns only methods that can be used immediately.
//
// Strategy: Create a minimal test PaymentIntent with automatic_payment_methods
// enabled, then inspect which payment_method_types Stripe returns. This
// reflects the actual account configuration (including business verification,
// currency support, and method-specific setup).
//
// Reference: https://stripe.com/docs/payments/payment-methods/integration-options#automatic
export async function GET() {
  try {
    const stripe = getStripe()

    // Create a test intent with HKD 1.00 to probe available methods
    const testIntent = await stripe.paymentIntents.create({
      amount: 100, // HK$1.00
      currency: 'hkd',
      automatic_payment_methods: { enabled: true },
      metadata: { probe: 'available_methods' },
    })

    // Extract the payment_method_types that Stripe enabled
    const availableTypes = testIntent.payment_method_types || []

    // Cancel the test intent immediately (we only needed it for discovery)
    await stripe.paymentIntents.cancel(testIntent.id)

    // Map Stripe's payment_method_types to our PaymentMethodId
    // Stripe returns: 'card', 'alipay', 'wechat_pay', etc.
    const methodMap: Record<string, string> = {
      card: 'card',
      alipay: 'alipay',
      wechat_pay: 'wechat_pay',
      // Stripe doesn't distinguish AlipayHK in payment_method_types,
      // it's part of 'alipay' with region detection
      google_pay: 'google_pay',
      apple_pay: 'apple_pay',
    }

    const available = availableTypes
      .map(type => methodMap[type])
      .filter(Boolean)

    console.log('[payment/available-methods] discovered', {
      stripeTypes: availableTypes,
      mapped: available,
    })

    return NextResponse.json({
      available,
      // Raw Stripe types for debugging
      _stripe_payment_method_types: availableTypes,
    })
  } catch (err) {
    const e = err as Error
    console.error('[payment/available-methods] error', {
      message: e.message,
      stack: e.stack,
    })

    // Fallback: if probe fails, return conservative default (card only)
    return NextResponse.json({
      available: ['card'],
      error: 'probe_failed',
      message: e.message,
    })
  }
}
