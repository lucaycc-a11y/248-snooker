import createMiddleware from 'next-intl/middleware'
import { NextRequest } from 'next/server'
import { routing } from './i18n/routing'
import { updateSession } from './lib/supabase/middleware'

const intlMiddleware = createMiddleware(routing)

// Public routes that have localized ([locale]) variants. Everything else
// (admin, auth, member, login, maintenance, api, static) is single-language
// and must bypass the intl rewrite so it keeps resolving at the root.
const LOCALIZED_ROOTS = ['book', 'pricing', 'about', 'faq', 'legal', 'terms', 'privacy', 'blog']

// Routes that must never be rewritten by intl middleware.
const BYPASS_PREFIXES = ['/api', '/auth', '/admin', '/member', '/login', '/maintenance']

function isLocalized(pathname: string): boolean {
  // Never rewrite auth/api routes — the OAuth callback must resolve as-is.
  if (BYPASS_PREFIXES.some((p) => pathname.startsWith(p))) return false

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

export function middleware(request: NextRequest) {
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
