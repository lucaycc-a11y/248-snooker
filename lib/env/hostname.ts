// Server-side hostname extraction from NextRequest or standard Request.
// Use this in API routes and middleware to get the hostname for environment
// detection (UAT vs production).

import { type NextRequest } from 'next/server'

/**
 * Extract hostname from request headers.
 * Checks x-forwarded-host (proxy/load balancer), then host header.
 *
 * @param request - NextRequest or standard Request
 * @returns hostname (e.g., 'uat.space8.com.hk') or null if not found
 */
export function getHostname(request: NextRequest | Request): string | null {
  const headers = request.headers

  // Check x-forwarded-host first (set by proxies/load balancers)
  const forwardedHost = headers.get('x-forwarded-host')
  if (forwardedHost) {
    // May be comma-separated if multiple proxies
    return forwardedHost.split(',')[0].trim()
  }

  // Fall back to host header
  const host = headers.get('host')
  if (host) {
    // Strip port if present
    return host.split(':')[0]
  }

  return null
}
