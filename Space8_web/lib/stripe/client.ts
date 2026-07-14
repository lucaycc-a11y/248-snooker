import { loadStripe, type Stripe } from '@stripe/stripe-js'

// Singleton browser Stripe loader. The publishable key is NEXT_PUBLIC (safe to
// ship to the client) and only needed at RUNTIME — builds fine when unset, then
// resolves to null until the env var is provided (the UI shows an error state
// rather than crashing).
let promise: Promise<Stripe | null> | null = null

export function getStripeClient(): Promise<Stripe | null> {
  if (!promise) {
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
    promise = key ? loadStripe(key) : Promise.resolve(null)
  }
  return promise
}
