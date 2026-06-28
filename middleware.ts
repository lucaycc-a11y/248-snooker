import createMiddleware from 'next-intl/middleware'
import { NextRequest, NextResponse } from 'next/server'
import { routing } from './i18n/routing'

const intlMiddleware = createMiddleware(routing)

// Public routes that have localized ([locale]) variants. Everything else
// (admin, auth, member, login, maintenance, api, static) is single-language
// and must bypass the intl rewrite so it keeps resolving at the root.
const LOCALIZED_ROOTS = ['book', 'pricing', 'about', 'faq']

function isLocalized(pathname: string): boolean {
  // strip a leading /en (or any configured locale) prefix
  const stripped = pathname.replace(
    new RegExp(`^/(${routing.locales.join('|')})(?=/|$)`),
    '',
  )
  const seg = stripped.split('/').filter(Boolean)[0]
  // homepage ('/' or '/en') or one of the localized roots
  return seg === undefined || LOCALIZED_ROOTS.includes(seg)
}

export function middleware(request: NextRequest) {
  if (!isLocalized(request.nextUrl.pathname)) {
    return NextResponse.next()
  }
  return intlMiddleware(request)
}

export const config = {
  // Skip Next internals and any path with a file extension.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
}
