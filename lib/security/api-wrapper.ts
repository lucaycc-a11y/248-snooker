import { NextRequest, NextResponse } from 'next/server'
import { checkCsrf } from './csrf'
import { rateLimitWithLogging, createRateLimitResponse } from './rate-limit-logging'
import { getClientIp } from './audit-log'

/**
 * Security wrapper for API route handlers.
 * Combines CSRF protection and rate limiting with audit logging.
 *
 * USAGE:
 *   export const POST = withSecurity(
 *     async (req: Request) => {
 *       // Your handler logic
 *       return NextResponse.json({ ok: true })
 *     },
 *     {
 *       csrf: true,
 *       rateLimit: { bucket: 'booking_create', max: 10, windowSeconds: 60 }
 *     }
 *   )
 */

export interface SecurityOptions {
  /** Enable CSRF protection (default: true for POST/PUT/PATCH/DELETE) */
  csrf?: boolean
  /** Rate limit configuration */
  rateLimit?: {
    bucket: string
    max: number
    windowSeconds: number
    /** Identifier type: 'ip' | 'user' | 'both' (default: 'ip') */
    identifierType?: 'ip' | 'user' | 'both'
  }
}

type ApiHandler = (req: Request, context?: { params: Record<string, string> }) => Promise<Response>

/**
 * Wrap an API handler with security checks (CSRF, rate limiting, audit logging).
 */
export function withSecurity(
  handler: ApiHandler,
  options: SecurityOptions = {}
): ApiHandler {
  return async (req: Request, context?: { params: Record<string, string> }) => {
    // CSRF protection (default: enabled for state-changing methods)
    const csrfEnabled = options.csrf ?? !['GET', 'HEAD', 'OPTIONS'].includes(req.method)
    if (csrfEnabled) {
      const csrfCheck = await checkCsrf(req)
      if (csrfCheck) return csrfCheck
    }

    // Rate limiting
    if (options.rateLimit) {
      const { bucket, max, windowSeconds, identifierType = 'ip' } = options.rateLimit
      const ip = getClientIp(req)

      // Check IP-based rate limit
      if (identifierType === 'ip' || identifierType === 'both') {
        const allowed = await rateLimitWithLogging(
          bucket,
          `ip:${ip}`,
          max,
          windowSeconds,
          req
        )
        if (!allowed) {
          return createRateLimitResponse(windowSeconds)
        }
      }

      // Check user-based rate limit (if user is authenticated)
      if (identifierType === 'user' || identifierType === 'both') {
        const userId = await extractUserId(req)
        if (userId) {
          const allowed = await rateLimitWithLogging(
            bucket,
            `user:${userId}`,
            max,
            windowSeconds,
            req
          )
          if (!allowed) {
            return createRateLimitResponse(windowSeconds)
          }
        }
      }
    }

    // Call the actual handler
    return handler(req, context)
  }
}

/**
 * Extract user ID from Supabase session (if authenticated).
 */
async function extractUserId(req: Request): Promise<string | null> {
  try {
    const { createServerClient } = await import('@supabase/ssr')
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => {
            const cookieHeader = req.headers.get('cookie') || ''
            return cookieHeader.split(';').map((c) => {
              const [name, ...rest] = c.trim().split('=')
              return { name, value: rest.join('=') }
            })
          },
          setAll: () => {}, // Read-only
        },
      }
    )

    const {
      data: { user },
    } = await supabase.auth.getUser()
    return user?.id ?? null
  } catch {
    return null
  }
}
