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
// coming-soon page (blocking it would redirect-loop).
const GATE_BYPASS_PREFIXES = ['/api', '/admin', '/auth', '/coming-soon', '/style-guide-preview']

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

  // Check for valid bypass cookie
  const secret = process.env.GATE_COOKIE_SECRET
  const cookie = request.cookies.get(GATE_COOKIE_NAME)?.value
  if (secret && cookie && (await verifyGateCookie(cookie, secret))) {
    // Valid cookie — access granted
    return null
  }

  // No valid bypass — redirect to maintenance page with 503 status
  // Log denied access attempt (fire-and-forget)
  logGateAccess(ip, 'denied', request.nextUrl.pathname).catch((err) =>
    console.error('[gate] log failed', err)
  )

  const url = request.nextUrl.clone()
  url.pathname = '/coming-soon'
  url.search = ''

  // Return 503 Service Unavailable with Retry-After header
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

  // Non-localized routes (/api, /auth, /admin, /member, /login, /maintenance) are
  // exactly the auth-sensitive ones — refresh the Supabase session here so a
  // single token rotation happens before any handler/RSC calls getUser(). This
  // is what kills the intermittent 401 (concurrent getUser() calls racing on the
  // one-time refresh token). Localized public pages don't touch auth, so they go
  // straight to the intl rewrite and never pay the refresh cost.
  if (!isLocalized(request.nextUrl.pathname)) {
    return updateSession(request)
  }
  return intlMiddleware(request)
}

export const config = {
  // Skip Next internals and any path with a file extension.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
}
