// Route guard utilities for authentication and authorization
// Used in middleware and server components to protect routes

import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

/**
 * Requires an authenticated user. Redirects to login if not authenticated.
 * Use in server components and route handlers that require authentication.
 */
export async function requireAuth(redirectTo?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    const returnUrl = redirectTo || '/auth'
    redirect(returnUrl)
  }

  return user
}

/**
 * Validates redirect URLs to prevent open redirect vulnerabilities.
 * Only allows same-origin redirects or explicitly allowed domains.
 */
export function validateRedirectUrl(url: string, allowedOrigins: string[] = []): string {
  try {
    const parsed = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'https://space8.com.hk')

    // Allow relative URLs (same origin)
    if (!parsed.hostname || parsed.hostname === new URL(typeof window !== 'undefined' ? window.location.origin : 'https://space8.com.hk').hostname) {
      return parsed.pathname + parsed.search + parsed.hash
    }

    // Check against allowed origins
    const origin = `${parsed.protocol}//${parsed.hostname}`
    if (allowedOrigins.includes(origin)) {
      return url
    }

    // Reject external URLs
    return '/'
  } catch {
    // Invalid URL - return safe default
    return '/'
  }
}

/**
 * Checks if user has completed their profile.
 * Used to gate features that require a complete profile (booking, etc).
 */
export async function requireCompleteProfile() {
  const user = await requireAuth()
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('users')
    .select('name, email, phone, email_verified_at, phone_verified_at')
    .eq('id', user.id)
    .single()

  if (!profile || !profile.name || !profile.email || !profile.phone || !profile.email_verified_at || !profile.phone_verified_at) {
    redirect('/auth?complete=true')
  }

  return { user, profile }
}
