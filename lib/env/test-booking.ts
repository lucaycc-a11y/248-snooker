// Test booking detection - single source of truth for is_test flag logic.
//
// Safety: is_test controls both availability filtering AND applyTestPriceOverride,
// so a false positive on production means a real customer pays the cheap test price.
// Therefore: when environment detection fails, we MUST default to NOT test (production).
//
// Usage:
//   import { isTestBooking } from '@/lib/env/test-booking'
//   const isTest = isTestBooking(getHostname(req))

import { isUatEnv } from './uat'

// Production hostnames - these are NEVER test bookings, even if VERCEL_ENV is wrong
const PROD_HOSTS = new Set(['space8.com.hk', 'www.space8.com.hk'])

/**
 * Determines if a booking should be flagged as is_test = true.
 *
 * Fail-safe logic:
 * - Production hostnames → always false (never test)
 * - UAT hostname (uat.space8.com.hk) → always true
 * - Non-production runtime (VERCEL_ENV=preview/development or NODE_ENV=development) → true
 * - Unknown/missing environment variables → false (assume production for safety)
 *
 * @param hostname - The hostname from request headers (e.g., 'space8.com.hk')
 * @returns true if this booking should be marked as is_test = true
 */
export function isTestBooking(hostname: string | null | undefined): boolean {
  const host = hostname ?? ''

  // Production domains are never test, even if VERCEL_ENV is misconfigured
  const isProdHost = PROD_HOSTS.has(host)
  if (isProdHost) {
    return false
  }

  // UAT domain is always test
  if (isUatEnv(host)) {
    return true
  }

  // Non-production runtime detection (fail-safe: unknown → false)
  // - VERCEL_ENV: explicitly check for 'preview' or 'development', not !== 'production'
  //   (if undefined, we want false, not true)
  // - NODE_ENV: covers local `next dev` which usually has no VERCEL_ENV
  const isNonProdRuntime =
    ['preview', 'development'].includes(process.env.VERCEL_ENV ?? '') ||
    process.env.NODE_ENV === 'development'

  return isNonProdRuntime
}
