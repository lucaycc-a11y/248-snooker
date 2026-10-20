import { NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe/server'
import { getServiceSupabase } from '@/lib/supabase/service'
import { PAYMENT_METHODS } from '@/lib/payments/methods'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/payment/available-methods?provider=kpay|stripe
//
// Returns the payment method ids the checkout may offer right now.
//
// provider=kpay  → the KPay rails from payment_settings, minus anything an
//                  operator explicitly turned off. A missing row is offered
//                  (see getPaymentMethodSettings). This is public data — it is
//                  exactly what the checkout selector is about to render.
// provider=stripe (default) → probes the Stripe account for what is actually
//                  configured (business verification, currency, method setup).
//
// Stripe strategy: create a minimal test PaymentIntent with
// automatic_payment_methods enabled, then inspect which payment_method_types
// Stripe returns.
//
// Reference: https://stripe.com/docs/payments/payment-methods/integration-options#automatic

/** Canonical KPay rail order — same source as the checkout selector and the
 *  admin toggles, so the three can never drift apart again. */
const KPAY_DISPLAY_ORDER: readonly string[] = PAYMENT_METHODS.map((m) => m.method)

async function kpayAvailableMethods(): Promise<string[]> {
  const supabase = getServiceSupabase()
  const { data, error } = await supabase.from('payment_settings').select('method, enabled')
  if (error) throw new Error(error.message)

  const disabled = new Set(
    (data ?? []).filter((row) => row.enabled === false).map((row) => row.method),
  )
  return KPAY_DISPLAY_ORDER.filter((method) => !disabled.has(method))
}

async function stripeAvailableMethods(): Promise<{
  available: string[]
  _stripe_payment_method_types?: string[]
}> {
  const stripe = getStripe()

  // Create a test intent with HKD 4.00 to probe available methods (Stripe minimum)
  const testIntent = await stripe.paymentIntents.create({
    amount: 400, // HK$4.00 (Stripe minimum for HKD)
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

  const available = availableTypes.map((type) => methodMap[type]).filter(Boolean)

  return { available, _stripe_payment_method_types: availableTypes }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const provider = searchParams.get('provider') || process.env.PAYMENT_PROVIDER || 'kpay'

  try {
    if (provider === 'kpay') {
      const available = await kpayAvailableMethods()
      console.log('[payment/available-methods] kpay enabled', available)
      return NextResponse.json({ available })
    }

    const result = await stripeAvailableMethods()
    console.log('[payment/available-methods] discovered', {
      stripeTypes: result._stripe_payment_method_types,
      mapped: result.available,
    })
    return NextResponse.json(result)
  } catch (err) {
    const e = err as Error
    console.error('[payment/available-methods] error', {
      provider,
      message: e.message,
      stack: e.stack,
    })

    // Fallback: never leave the checkout with nothing to offer. For KPay the
    // full rail set is the safe default — create still rejects anything an
    // operator turned off. For Stripe, be conservative (card only).
    return NextResponse.json({
      available: provider === 'kpay' ? [...KPAY_DISPLAY_ORDER] : ['card'],
      error: 'probe_failed',
      message: e.message,
    })
  }
}
