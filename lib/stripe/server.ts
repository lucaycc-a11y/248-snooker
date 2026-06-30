import Stripe from 'stripe'

// Server-only Stripe singleton.
//
// DEPENDENCY: the `stripe` package is NOT yet in package.json. Run `npm i stripe`
// (and for the client Payment Element: `npm i @stripe/stripe-js @stripe/react-stripe-js`)
// once disk space is freed. Until then this import will not resolve and tsc/build
// will fail — expected, per the "write files only, don't build" instruction.
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
