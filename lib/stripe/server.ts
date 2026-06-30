import Stripe from 'stripe'

// Server-only Stripe singleton. Throws if STRIPE_SECRET_KEY is unset so callers
// can surface a specific config error (create-intent wraps this).
let cached: Stripe | null = null

export function getStripe(): Stripe {
  if (cached) return cached

  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set')

  // apiVersion intentionally omitted → the SDK uses the version pinned to your
  // Stripe account in the dashboard, avoiding a hardcoded version drifting out of
  // sync with the installed types.
  cached = new Stripe(key)
  return cached
}
