// ─────────────────────────────────────────────────────────────────
// GET /api/stripe/check-methods — Check which payment methods are
// actually enabled in Stripe Dashboard. Admin/debug only.
// ─────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const secretKey = process.env.STRIPE_SECRET_KEY
    if (!secretKey) {
      return NextResponse.json(
        { error: 'STRIPE_SECRET_KEY not configured' },
        { status: 500 }
      )
    }

    const Stripe = require('stripe')
    const stripe = new Stripe(secretKey, {
      apiVersion: '2026-06-24.dahlia',
      typescript: true,
    }) as import('stripe').Stripe

    // Create a temporary PaymentIntent to discover available methods
    const intent = await stripe.paymentIntents.create({
      amount: 100, // HKD 1.00
      currency: 'hkd',
      automatic_payment_methods: { enabled: true },
    })

    const availableMethods = intent.payment_method_types || []

    return NextResponse.json({
      available_payment_methods: availableMethods,
      raw_intent_id: intent.id,
      note: 'This shows which payment methods are enabled in your Stripe Dashboard for HKD currency',
    })
  } catch (error: unknown) {
    const err = error as { message?: string; type?: string; code?: string }
    console.error('[stripe/check-methods] error', {
      message: err.message,
      type: err.type,
      code: err.code,
    })
    return NextResponse.json(
      {
        error: 'Failed to check Stripe payment methods',
        detail: err.message || 'Unknown error',
      },
      { status: 500 }
    )
  }
}
