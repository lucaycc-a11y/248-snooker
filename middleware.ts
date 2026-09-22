import createMiddleware from 'next-intl/middleware'
import { NextRequest, NextResponse } from 'next/server'
import { routing } from './i18n/routing'
import { updateSession } from './lib/supabase/middleware'
import { getSiteGate } from './lib/gate/config'
import { GATE_COOKIE_NAME, verifyGateCookie } from './lib/gate/cookie'

const intlMiddleware = createMiddleware(routing)

// Public routes that have localized ([locale]) variants. Everything else
// (admin, auth, member, login, maintenance, api, static) is single-language
// and must bypass the intl rewrite so it keeps resolving at the root.
const LOCALIZED_ROOTS = ['book', 'pricing', 'about', 'faq', 'legal', 'terms', 'privacy', 'blog', 'venue', 'membership', 'credits']

// Routes that must never be rewritten by intl middleware.
const BYPASS_PREFIXES = ['/api', '/auth', '/admin', '/member', '/login', '/maintenance', '/coming-soon', '/style-guide-preview']

// Routes the site gate never blocks: admin (needs to reach the toggle even
// while gated), the API (the gate's own verify/waitlist endpoints live here,
// plus webhooks/auth callbacks that must always work), and the gate's own
// coming-soon page (blocking it would redirect-loop). Also includes /uat-gate
// for UAT domain visitors.
const GATE_BYPASS_PREFIXES = ['/api', '/admin', '/auth', '/coming-soon', '/uat-gate', '/style-guide-preview']

function clientIp(request: NextRequest): string {
  const fwd = request.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return request.headers.get('x-real-ip')?.trim() || 'unknown'
}

async function checkSiteGate(request: NextRequest): Promise<NextResponse | null> {
  if (GATE_BYPASS_PREFIXES.some((p) => request.nextUrl.pathname.startsWith(p))) return null

  // Local-dev escape hatch: set DISABLE_SITE_GATE=1 in .env.local to skip the
  // gate. Only ever set this locally — production must never define it.
  if (process.env.DISABLE_SITE_GATE === '1') return null

  const { config, whitelist } = await getSiteGate()
  if (!config.enabled) return null

  const ip = clientIp(request)

  // IP whitelist bypass — access granted, log it
  if (whitelist.includes(ip)) {
    // Log successful whitelist access (fire-and-forget, don't block the request)
    logGateAccess(ip, 'whitelist', request.nextUrl.pathname).catch((err) =>
      console.error('[gate] log failed', err)
    )
    return null
  }

  // Check for valid bypass cookie — version must match current DB value so a
  // password change immediately invalidates all previously issued cookies.
  const secret = process.env.GATE_COOKIE_SECRET
  const cookie = request.cookies.get(GATE_COOKIE_NAME)?.value
  if (secret && cookie && (await verifyGateCookie(cookie, secret, config.passwordVersion))) {
    // Valid cookie — access granted
    return null
  }

  // No valid bypass — redirect to maintenance page with 503 status
  // Log denied access attempt (fire-and-forget)
  logGateAccess(ip, 'denied', request.nextUrl.pathname).catch((err) =>
    console.error('[gate] log failed', err)
  )

  // Detect if this is the UAT domain
  const host = request.headers.get('host') || ''
  const isUatDomain = host.includes('uat.space8.com.hk')

  const url = request.nextUrl.clone()
  // UAT domain visitors go to /uat-gate (which redirects to production after 3s)
  // Production domain visitors go to /coming-soon (standard maintenance page)
  url.pathname = isUatDomain ? '/uat-gate' : '/coming-soon'
  url.search = ''

  // Return 307 Temporary Redirect with Retry-After header
  const response = NextResponse.redirect(url, { status: 307 })
  response.headers.set('Retry-After', '3600') // Suggest retry in 1 hour

  // Note: The actual 503 status must be set in the coming-soon page's response
  // since NextResponse.redirect() forces a 3xx status code. The redirect gets
  // the user to the maintenance page; the page itself returns 503.
  return response
}

// Helper to log gate access attempts to site_gate_access_log
async function logGateAccess(
  ip: string,
  method: 'whitelist' | 'password' | 'denied',
  pathname: string
): Promise<void> {
  try {
    const { getServiceSupabase } = await import('@/lib/supabase/service')
    const supabase = getServiceSupabase()
    await supabase.from('site_gate_access_log').insert({
      ip_address: ip,
      method,
      pathname,
      user_agent: '', // Could extract from request.headers if needed
    })
  } catch (err) {
    // Log failure is non-critical, don't throw
    console.error('[gate] failed to log access', err)
  }
}

// Password gate: redirects authenticated users without a password to /auth/set-password.
// This enforces requirement A: no user may access member pages, booking flow, or
// checkout without first setting a password.
async function checkPasswordGate(
  request: NextRequest,
  response: NextResponse
): Promise<NextResponse | null> {
  const pathname = request.nextUrl.pathname

  // Skip the gate for:
  // - The set-password page itself (would redirect-loop)
  // - Auth/login routes (user needs to reach login to authenticate first)
  // - API routes (webhooks, auth callbacks, change-request endpoints)
  // - Admin (admin login uses separate auth, should not be gated by member password)
  // - Static/public pages
  const GATE_BYPASS = [
    '/auth/set-password',
    '/auth/login',
    '/login',
    '/auth/callback',
    '/auth/change-password',
    '/auth/change-phone',
    '/api/',
    '/admin',
    '/maintenance',
    '/coming-soon',
    '/_next/',
    '/favicon',
  ]

  if (GATE_BYPASS.some((p) => pathname.startsWith(p))) {
    return null
  }

  // Only gate member-facing pages: /member, /book, checkout (future), etc.
  // Public pages like homepage, pricing, about should not require a password.
  const GATED_PREFIXES = ['/member', '/book']
  if (!GATED_PREFIXES.some((p) => pathname.startsWith(p))) {
    return null
  }

  try {
    // Extract user from the response cookies (the session was just refreshed by updateSession)
    const { createServerClient } = await import('@supabase/ssr')

    // Parse cookies from the response that updateSession just set
    const responseCookies = new Map<string, string>()
    response.headers.getSetCookie().forEach((cookie) => {
      const [nameValue] = cookie.split(';')
      const [name, value] = nameValue.split('=')
      if (name && value) responseCookies.set(name.trim(), value.trim())
    })

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => {
            // Merge request cookies with fresh response cookies (response takes precedence)
            const allCookies: { name: string; value: string }[] = []
            const requestCookies = request.cookies.getAll()
            const names = new Set([
              ...requestCookies.map((c) => c.name),
              ...responseCookies.keys(),
            ])
            names.forEach((name) => {
              const value = responseCookies.get(name) ?? requestCookies.find((c) => c.name === name)?.value
              if (value) allCookies.push({ name, value })
            })
            return allCookies
          },
          setAll: () => {}, // Read-only
        },
      }
    )

    const {
      data: { user },
    } = await supabase.auth.getUser()

    // Not authenticated → let them through (they'll hit the login page naturally)
    if (!user) return null

    // Check if password is set
    const { getServiceSupabase } = await import('@/lib/supabase/service')
    const service = getServiceSupabase()
    const { data: status } = await service
      .from('user_password_status')
      .select('password_set')
      .eq('user_id', user.id)
      .maybeSingle<{ password_set: boolean }>()

    // Password not set → redirect to set-password page
    if (!status?.password_set) {
      const url = request.nextUrl.clone()
      url.pathname = '/auth/set-password'
      url.search = '' // Clear query params
      return NextResponse.redirect(url)
    }

    // Password is set → allow through
    return null
  } catch (err) {
    // On error, fail open (don't block access) but log the issue
    console.error('[password-gate] check failed:', err)
    return null
  }
}

function isLocalized(pathname: string): boolean {
  // Never rewrite auth/api routes — the OAuth callback must resolve as-is.
  // Segment-exact match: '/member' must NOT swallow '/membership' (a public
  // localized page) — plain startsWith did, which 404'd /membership.
  if (BYPASS_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return false

  const segments = pathname.split('/').filter(Boolean)
  if (segments[0] && routing.locales.includes(segments[0] as (typeof routing.locales)[number])) {
    return true
  }

  // strip a leading locale prefix
  const stripped = pathname.replace(
    new RegExp(`^/(${routing.locales.join('|')})(?=/|$)`),
    '',
  )
  const seg = stripped.split('/').filter(Boolean)[0]
  // homepage or one of the localized roots
  return seg === undefined || LOCALIZED_ROOTS.includes(seg)
}

export async function middleware(request: NextRequest) {
  // The style-guide is a mock-only acceptance surface and intentionally does
  // not require an authenticated admin session.
  if (request.nextUrl.pathname === '/admin/style-guide') {
    return NextResponse.rewrite(new URL('/style-guide-preview', request.url))
  }

  const gateRedirect = await checkSiteGate(request)
  if (gateRedirect) return gateRedirect

  // Webhook routes must bypass ALL middleware processing to preserve raw headers
  // (e.g. stripe-signature). NextResponse.next({request}) in updateSession()
  // rebuilds the request and can strip these headers, breaking signature verification.
  if (request.nextUrl.pathname.startsWith('/api/webhooks/')) {
    return NextResponse.next()
  }

  // Non-localized routes (/api, /auth, /admin, /member, /login, /maintenance) are
  // exactly the auth-sensitive ones — refresh the Supabase session here so a
  // single token rotation happens before any handler/RSC calls getUser(). This
  // is what kills the intermittent 401 (concurrent getUser() calls racing on the
  // one-time refresh token). Localized public pages don't touch auth, so they go
  // straight to the intl rewrite and never pay the refresh cost.
  if (!isLocalized(request.nextUrl.pathname)) {
    const response = await updateSession(request)

    // Password gate: authenticated users without a password are redirected to
    // /auth/set-password (except when already on that page, or on auth/API routes)
    const passwordGateRedirect = await checkPasswordGate(request, response)
    if (passwordGateRedirect) return passwordGateRedirect

    return response
  }

  // For localized routes, run intlMiddleware and ensure locale cookie is properly set
  const intlResponse = intlMiddleware(request)

  // Ensure NEXT_LOCALE cookie has correct flags for client-side reading
  // (it must NOT be HttpOnly so the language switcher can read it)
  const localeCookie = intlResponse.cookies.get('NEXT_LOCALE')
  if (localeCookie) {
    intlResponse.cookies.set('NEXT_LOCALE', localeCookie.value, {
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      httpOnly: false, // MUST be false for client-side language switcher
      maxAge: 31536000, // 1 year
    })
  }

  return intlResponse
}

export const config = {
  // Skip Next internals and any path with a file extension.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
}
