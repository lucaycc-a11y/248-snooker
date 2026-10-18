import { NextRequest, NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { withSecurity, SecurityOptions } from './api-wrapper'

/**
 * Admin-specific security wrapper that combines authentication + role check + CSRF + rate limiting.
 *
 * Usage:
 *   export const POST = withAdminSecurity(async (req, adminUser) => {
 *     // Handler logic with guaranteed admin user
 *     return NextResponse.json({ ok: true })
 *   })
 *
 * For dynamic routes with params:
 *   export const POST = withAdminSecurity(async (req, adminUser, context) => {
 *     const { params } = context
 *     const bookingId = params.id
 *     return NextResponse.json({ ok: true })
 *   })
 *
 * Enforces:
 * 1. User must be authenticated
 * 2. User must be an active admin in admin_users (getAdminData)
 * 3. CSRF protection (enabled by default)
 * 4. Rate limiting (30 per minute by default, user-based)
 */

type AdminUser = { id: string; email?: string }
type AdminHandler = (
  req: Request,
  adminUser: AdminUser,
  context?: { params: Record<string, string> }
) => Promise<Response>

export function withAdminSecurity(
  handler: AdminHandler,
  options: Partial<SecurityOptions> = {}
): (req: Request, context?: { params: Record<string, string> }) => Promise<Response> {
  // Default admin rate limit: 30 requests per minute (stricter than public endpoints)
  const adminOptions: SecurityOptions = {
    csrf: true,
    rateLimit: {
      bucket: options.rateLimit?.bucket ?? 'admin_default',
      max: options.rateLimit?.max ?? 30,
      windowSeconds: options.rateLimit?.windowSeconds ?? 60,
      identifierType: 'user', // Admin actions are user-based, not IP-based
    },
    ...options,
  }

  // Wrap with base security (CSRF + rate limiting)
  return withSecurity(async (req: Request, context?: { params: Record<string, string> }) => {
    // Admin-specific checks: authentication + role verification.
    // Source of truth is admin_users (active invite) via getAdminData(), the
    // same check as the /admin layout. The previous check read users.is_admin,
    // a column that does not exist, so every wrapped route returned 403.
    const admin = await getAdminData()

    if (!admin) {
      console.warn('[admin] access_denied')
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
    }

    const user = { id: admin.userId, email: admin.email }

    // Call the actual handler with authenticated admin user and context
    return handler(req, { id: user.id, email: user.email }, context)
  }, adminOptions)
}
