import { getServiceSupabase } from '@/lib/supabase/service'
import { logSecurityEvent } from './audit-log'

/**
 * Enhanced rate limiting with security audit logging.
 * Wraps the existing rate-limit.ts with security event logging.
 */

/**
 * Rate limit with audit logging.
 * Returns true if ALLOWED, false if rate limit exceeded.
 * Logs rate-limit triggers to security_audit_log.
 */
export async function rateLimitWithLogging(
  bucket: string,
  identifier: string,
  max: number,
  windowSeconds: number,
  req: Request
): Promise<boolean> {
  try {
    const supabase = getServiceSupabase()
    const { data, error } = await supabase.rpc('check_rate_limit', {
      p_bucket: bucket,
      p_identifier: identifier,
      p_limit: max,
      p_window_seconds: windowSeconds,
    })

    if (error) {
      console.error('[rate-limit] service_unhealthy_rejecting', {
        message: error.message,
        code: (error as { code?: string }).code,
        bucket,
        identifier,
        strategy: 'fail_closed',
      })
      return false
    }

    if (typeof data !== 'boolean') {
      console.error('[rate-limit] service_unhealthy_rejecting', {
        bucket,
        identifier,
        strategy: 'fail_closed',
        reason: 'invalid_rpc_result',
      })
      return false
    }

    // Log rate-limit trigger
    if (!data) {
      const url = new URL(req.url)
      await logSecurityEvent({
        eventType: 'rate_limit_triggered',
        ipAddress: extractIp(identifier) || getClientIp(req),
        userAgent: req.headers.get('user-agent'),
        targetResource: url.pathname,
        metadata: {
          bucket,
          identifier,
          max,
          windowSeconds,
        },
      })
    }

    return data
  } catch (err) {
    console.error('[rate-limit] service_unhealthy_rejecting', {
      message: err instanceof Error ? err.message : 'unknown error',
      bucket,
      identifier,
      strategy: 'fail_closed',
    })
    return false
  }
}

/**
 * Extract IP from identifier (if it's in 'ip:xxx' format).
 */
function extractIp(identifier: string): string | null {
  if (identifier.startsWith('ip:')) {
    return identifier.slice(3)
  }
  return null
}

/**
 * Extract client IP from request headers.
 */
function getClientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return req.headers.get('x-real-ip')?.trim() || 'unknown'
}

/**
 * Create rate limit response with Retry-After header.
 */
export function createRateLimitResponse(windowSeconds: number): Response {
  return new Response(
    JSON.stringify({
      error: 'Too many requests. Please try again later.',
      code: 'RATE_LIMIT_EXCEEDED',
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(windowSeconds),
      },
    }
  )
}
