/**
 * Section 0: Definition of a "complete account" (`profile_complete = true`)
 *
 * This is the SINGLE SOURCE OF TRUTH for profile completeness.
 * Every gating route must call this function — never duplicate the logic.
 *
 * An account is complete ONLY when ALL of the following hold:
 * 1. display_name set — non-empty, 1–50 characters, not purely whitespace or emoji
 * 2. Email verified — row exists in auth_identities with type='email', verified=true
 * 3. Phone verified — row exists in auth_identities with type='phone', verified=true, format +852XXXXXXXX
 * 4. Terms & Privacy accepted — stored version and timestamp
 * 5. Marketing preference explicitly set (not null)
 *
 * NOT required: password (optional), avatar (optional)
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export interface ProfileCompleteCheck {
  isComplete: boolean
  missing: Array<'display_name' | 'email_verified' | 'phone_verified' | 'terms_accepted' | 'marketing_preference'>
  user?: {
    id: string
    display_name: string | null
    email: string | null
    phone: string | null
    terms_accepted_at: string | null
    marketing_opted_in: boolean | null
  }
}

/**
 * Check if a user's profile is complete according to Section 0 definition.
 *
 * @param supabase - Supabase client (must be authenticated)
 * @param userId - User ID to check (optional, defaults to current session user)
 * @returns Profile completeness status and missing fields
 */
export async function checkProfileComplete(
  supabase: SupabaseClient,
  userId?: string
): Promise<ProfileCompleteCheck> {
  // Get user ID from session if not provided
  let targetUserId = userId
  if (!targetUserId) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return {
        isComplete: false,
        missing: ['display_name', 'email_verified', 'phone_verified', 'terms_accepted', 'marketing_preference'],
      }
    }
    targetUserId = user.id
  }

  // Fetch user profile
  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('id, display_name, email, phone, terms_accepted_at, marketing_opted_in')
    .eq('id', targetUserId)
    .maybeSingle()

  if (profileError || !profile) {
    return {
      isComplete: false,
      missing: ['display_name', 'email_verified', 'phone_verified', 'terms_accepted', 'marketing_preference'],
    }
  }

  const missing: ProfileCompleteCheck['missing'] = []

  // 1. Check display_name: non-empty, 1-50 chars, not purely whitespace/emoji
  const name = profile.display_name?.trim() ?? ''
  if (name.length < 1 || name.length > 50 || /^[\s\p{Emoji}]+$/u.test(name)) {
    missing.push('display_name')
  }

  // 2. Check email verified via auth_identities
  const { data: emailIdentity } = await supabase
    .from('auth_identities')
    .select('verified')
    .eq('user_id', targetUserId)
    .in('provider', ['email', 'google', 'apple']) // OAuth providers also count as verified email
    .eq('verified', true)
    .maybeSingle()

  if (!emailIdentity) {
    missing.push('email_verified')
  }

  // 3. Check phone verified via auth_identities
  const { data: phoneIdentity } = await supabase
    .from('auth_identities')
    .select('verified, identifier')
    .eq('user_id', targetUserId)
    .eq('provider', 'phone')
    .eq('verified', true)
    .maybeSingle()

  // Phone must be verified AND in correct format (+852XXXXXXXX)
  if (!phoneIdentity || !phoneIdentity.identifier?.match(/^\+852\d{8}$/)) {
    missing.push('phone_verified')
  }

  // 4. Check terms accepted (non-null timestamp)
  if (!profile.terms_accepted_at) {
    missing.push('terms_accepted')
  }

  // 5. Check marketing preference explicitly set (not null)
  if (profile.marketing_opted_in === null || profile.marketing_opted_in === undefined) {
    missing.push('marketing_preference')
  }

  return {
    isComplete: missing.length === 0,
    missing,
    user: profile,
  }
}

/**
 * Middleware helper: check profile complete and redirect if not.
 * Use this in page-level guards (booking, member dashboard, etc.)
 */
export function requireCompleteProfile(redirectPath: string = '/complete-profile') {
  return async (supabase: SupabaseClient): Promise<{ redirect?: string }> => {
    const check = await checkProfileComplete(supabase)
    if (!check.isComplete) {
      return { redirect: redirectPath }
    }
    return {}
  }
}
