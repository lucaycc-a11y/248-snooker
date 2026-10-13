/**
 * Stripe.js preload module
 *
 * Separates Stripe.js preloading from component rendering.
 * Call `preloadStripe()` early in the booking flow (e.g., page mount)
 * so the SDK downloads in the background while user selects tables/dates.
 *
 * By the time user reaches payment step, Stripe.js is already loaded.
 */

import { loadStripe, Stripe } from '@stripe/stripe-js'

let stripePromise: Promise<Stripe | null> | null = null

/**
 * Preload Stripe.js SDK immediately.
 * Safe to call multiple times — only loads once.
 *
 * Call this at the top of the booking page (e.g., useEffect on mount)
 * so Stripe.js downloads while user is selecting tables/dates.
 */
export function preloadStripe(): Promise<Stripe | null> | null {
  if (stripePromise) return stripePromise

  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  if (!key) {
    console.error('[Stripe Preload] Missing NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY')
    return null
  }

  // Start loading Stripe.js immediately
  stripePromise = loadStripe(key)
  return stripePromise
}

/**
 * Get the preloaded Stripe instance.
 * Returns null if preloadStripe() was never called or the key is missing.
 */
export function getPreloadedStripe(): Promise<Stripe | null> | null {
  return stripePromise
}
