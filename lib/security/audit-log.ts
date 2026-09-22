import { getServiceSupabase } from '@/lib/supabase/service'

/**
 * Security audit log event types.
 * CRITICAL: Never log secrets, tokens, OTPs, or plaintext passwords in metadata.
 */
export type SecurityEventType =
  | 'login_success'
  | 'login_failure'
  | 'password_change_request'
  | 'password_change_complete'
  | 'phone_change_request'
  | 'phone_change_complete'
  | 'csrf_rejection'
  | 'rate_limit_triggered'
  | 'session_created'
  | 'session_expired'
  | 'otp_sent'
  | 'otp_verification_failed'
  | 'otp_verification_success'

export interface SecurityAuditEvent {
  userId?: string // NULL for unauthenticated events
  eventType: SecurityEventType
  ipAddress: string
  userAgent?: string | null
  targetResource?: string // e.g. '/api/auth/login', 'booking:123'
  metadata?: Record<string, unknown> // NEVER include secrets/tokens/OTPs
}

/**
 * Log a security event to the audit log.
 * Fire-and-forget: logs asynchronously and never throws.
 *
 * CRITICAL: Never pass secrets, tokens, OTPs, or plaintext passwords in metadata.
 */
export async function logSecurityEvent(event: SecurityAuditEvent): Promise<void> {
  try {
    const supabase = getServiceSupabase()
    const { error } = await supabase.from('security_audit_log').insert({
      user_id: event.userId ?? null,
      event_type: event.eventType,
      ip_address: event.ipAddress,
      user_agent: event.userAgent ?? null,
      target_resource: event.targetResource ?? null,
      metadata: event.metadata ?? null,
    })

    if (error) {
      console.error('[security-audit] failed to log event', {
        eventType: event.eventType,
        error: error.message,
      })
    }
  } catch (err) {
    // Fire-and-forget: don't let logging failures break the request
    console.error('[security-audit] unexpected error', err)
  }
}

/**
 * Extract client IP from request headers (x-forwarded-for, x-real-ip).
 */
export function getClientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return req.headers.get('x-real-ip')?.trim() || 'unknown'
}

/**
 * Extract user agent from request headers.
 */
export function getUserAgent(req: Request): string | null {
  return req.headers.get('user-agent')
}
