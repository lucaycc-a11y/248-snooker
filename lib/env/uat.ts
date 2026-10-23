// UAT environment detection - single source of truth for all UAT-related
// branching logic (payment keys, badges, test data flags, etc.)
//
// Usage:
//   import { isUatEnv } from '@/lib/env/uat'
//   if (isUatEnv(hostname)) { ... }

/**
 * Determines if the current request is on the UAT domain.
 *
 * Must be called with the actual request hostname (from headers or NextRequest)
 * so it works correctly in both server-side (API routes, middleware) and
 * edge contexts.
 *
 * @param hostname - The hostname from request headers (e.g., 'uat.space8.com.hk')
 * @returns true if this is the UAT environment
 */
export function isUatEnv(hostname: string | null | undefined): boolean {
  if (!hostname) return false
  return hostname === 'uat.space8.com.hk'
}

/**
 * Get the appropriate KPay environment string based on hostname.
 * Returns 'uat' for the UAT domain, 'prod' everywhere else (hard-coded).
 *
 * @param hostname - The hostname from request headers
 * @returns 'prod' or 'uat'
 */
export function getKPayEnv(hostname: string | null | undefined): 'prod' | 'uat' {
  // UAT domain always uses KPay UAT keys
  if (isUatEnv(hostname)) return 'uat'

  // Every other host is live. Hard-coded on purpose: the public flow must use the
  // same production KPay as the admin route and must not depend on a KPAY_ENV var.
  return 'prod'
}
