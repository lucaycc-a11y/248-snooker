import { ALL_LOCALES } from '@/i18n/enabled-locales'

// Page-level onboarding gate for /member and /book.
//
// Why this exists: a Google (or email) signup gets a session before its second
// identity is verified. /auth/callback correctly sends that user to /login so
// AuthCard can collect the missing contact, but nothing stopped them from typing
// /member or /book directly. They then reached checkout, where
// requireCompleteProfile() 403s and the payment UI shows only a generic error —
// a dead end. This gate routes them to the profile step instead.
//
// Fails OPEN (like checkPasswordGate): the money APIs still enforce
// requireCompleteProfile(), which fails closed, so a lookup error here costs a
// missed redirect, never an unverified booking.

export type OnboardingRow = {
  onboarding_status: string | null
  profile_complete: boolean | null
}

export type OnboardingGateDeps = {
  /** Authenticated user id from the session cookie, or null if signed out. */
  getUserId: () => Promise<string | null>
  /** True when the user is an active admin (admin_users.is_active). */
  isActiveAdmin: (userId: string) => Promise<boolean>
  /** The user's onboarding columns from public.users. */
  getOnboarding: (userId: string) => Promise<OnboardingRow | null>
}

const LOCALE_PREFIX = new RegExp(`^/(${ALL_LOCALES.join('|')})(?=/|$)`)

/** Strip a leading locale segment: /zh-HK/book -> /book. */
function stripLocale(pathname: string): string {
  return pathname.replace(LOCALE_PREFIX, '') || '/'
}

/**
 * Whether a path is gated. Segment-exact, so /membership (a public page) is
 * never caught by /member. /login, /auth, /api, /admin and static files are
 * never gated, which is also what makes the redirect loop-free.
 */
export function isOnboardingGatedPath(pathname: string): boolean {
  const p = stripLocale(pathname)
  if (/\.[a-z0-9]+$/i.test(p)) return false
  return ['/member', '/book'].some((root) => p === root || p.startsWith(`${root}/`))
}

export function isOnboardingComplete(row: OnboardingRow | null): boolean {
  return row?.onboarding_status === 'complete' || row?.profile_complete === true
}

/**
 * Returns the redirect target (/login?returnUrl=...) for a signed-in user who
 * has not finished onboarding, or null to let the request through.
 */
export async function checkOnboardingGate(
  pathname: string,
  search: string,
  deps: OnboardingGateDeps,
): Promise<string | null> {
  if (!isOnboardingGatedPath(pathname)) return null

  try {
    const userId = await deps.getUserId()
    // Signed out: /member and /book handle their own login step.
    if (!userId) return null
    if (await deps.isActiveAdmin(userId)) return null
    if (isOnboardingComplete(await deps.getOnboarding(userId))) return null

    const params = new URLSearchParams({ returnUrl: `${pathname}${search}` })
    return `/login?${params.toString()}`
  } catch (err) {
    console.error('[onboarding-gate] check failed, allowing:', err instanceof Error ? err.message : 'unknown')
    return null
  }
}
