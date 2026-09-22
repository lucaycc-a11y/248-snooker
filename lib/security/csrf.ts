import { NextRequest, NextResponse } from 'next/server'
import { logSecurityEvent, getClientIp, getUserAgent } from './audit-log'

/**
 * CSRF protection middleware for state-changing API routes.
 *
 * Apple-level security: validates Origin/Referer headers to prevent cross-site
 * request forgery. Works with cookie-based authentication (Supabase session).
 *
 * HOW IT WORKS:
 * - For state-changing requests (POST, PUT, PATCH, DELETE), checks that the
 *   Origin or Referer header matches the request's host (same-origin policy).
 * - GET/HEAD/OPTIONS are exempt (read-only, safe methods).
 * - Requests with no Origin/Referer are REJECTED (modern browsers always send one).
 *
 * USAGE:
 *   export async function POST(req: Request) {
 *     const csrfCheck = await checkCsrf(req)
 *     if (csrfCheck) return csrfCheck // 403 if CSRF detected
 *
 *     // ... rest of handler
 *   }
 *
 * WEBHOOK BYPASS:
 * - Webhooks (Stripe, KPay) use signature verification, not cookies.
 * - They must be exempted at the middleware level (middleware.ts already does this).
 * - Do NOT call checkCsrf() on webhook routes.
 */

const ALLOWED_ORIGINS = [
  'https://space8.com.hk',
  'https://www.space8.com.hk',
  'https://uat.space8.com.hk',
]

// Add localhost for local development
if (process.env.NODE_ENV === 'development') {
  ALLOWED_ORIGINS.push('http://localhost:3000')
}

/**
 * Check CSRF protection for state-changing requests.
 * Returns NextResponse with 403 if CSRF is detected, null if request is safe.
 */
export async function checkCsrf(req: Request): Promise<NextResponse | null> {
  const method = req.method

  // Safe methods (read-only) are exempt from CSRF protection
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return null
  }

  // State-changing methods (POST, PUT, PATCH, DELETE) require origin validation
  const origin = req.headers.get('origin')
  const referer = req.headers.get('referer')

  // Modern browsers always send Origin or Referer for cross-origin requests.
  // Missing both is suspicious (curl/bot/malicious client).
  if (!origin && !referer) {
    await logCsrfRejection(req, 'missing_origin_and_referer')
    return NextResponse.json(
      { error: 'Forbidden: missing origin/referer header' },
      { status: 403 }
    )
  }

  // Check Origin header (preferred)
  if (origin) {
    if (!isAllowedOrigin(origin)) {
      await logCsrfRejection(req, 'invalid_origin', origin)
      return NextResponse.json(
        { error: 'Forbidden: invalid origin' },
        { status: 403 }
      )
    }
    return null
  }

  // Fallback to Referer header
  if (referer) {
    try {
      const refererUrl = new URL(referer)
      const refererOrigin = `${refererUrl.protocol}//${refererUrl.host}`
      if (!isAllowedOrigin(refererOrigin)) {
        await logCsrfRejection(req, 'invalid_referer', refererOrigin)
        return NextResponse.json(
          { error: 'Forbidden: invalid referer' },
          { status: 403 }
        )
      }
      return null
    } catch {
      await logCsrfRejection(req, 'malformed_referer', referer)
      return NextResponse.json(
        { error: 'Forbidden: malformed referer' },
        { status: 403 }
      )
    }
  }

  // Should never reach here (already checked both are null above)
  await logCsrfRejection(req, 'unknown_failure')
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

/**
 * Check if an origin is in the allowlist.
 */
function isAllowedOrigin(origin: string): boolean {
  return ALLOWED_ORIGINS.includes(origin)
}

/**
 * Log CSRF rejection to audit log.
 */
async function logCsrfRejection(
  req: Request,
  reason: string,
  receivedValue?: string
): Promise<void> {
  const url = new URL(req.url)
  await logSecurityEvent({
    eventType: 'csrf_rejection',
    ipAddress: getClientIp(req),
    userAgent: getUserAgent(req),
    targetResource: url.pathname,
    metadata: {
      reason,
      receivedValue,
      method: req.method,
    },
  })
}

/**
 * CSRF protection for Next.js middleware (optional, for route-level protection).
 * Most routes should use checkCsrf() in their handlers instead.
 */
export async function csrfMiddleware(req: NextRequest): Promise<NextResponse | null> {
  return checkCsrf(req)
}
