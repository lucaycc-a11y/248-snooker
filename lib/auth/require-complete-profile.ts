import type { SupabaseClient } from '@supabase/supabase-js'

// Server-side booking gate for a completed profile.
//
// Why this exists: /member is gated by an RSC redirect, but the money paths
// (/api/checkout/create, /api/payment/create-intent) authenticated the caller
// without ever checking onboarding_status. A client that skipped or dismissed
// the profile step still holds a valid session, so it could drive a booking
// straight through the API and end up with a paid slot owned by an account
// carrying no verified name, email or phone — the exact state the profile step
// exists to prevent. A UI-only gate is not a gate.
//
// Reads through the caller's own request-scoped client rather than the
// service-role client: the user is only ever inspecting their own row, so RLS
// should stay in force. Fails CLOSED — unlike rateLimit(), a lookup error here
// blocks rather than allows, because the cost of a wrong "allow" is a booking
// attached to an unverified identity.
//
// Checks onboarding_status (the canonical state for the 2-identity flow) and
// falls back to the legacy profile_complete boolean for accounts that predate
// the migration.
export type ProfileGateResult = { ok: true } | { ok: false; status: number; error: string }

export async function requireCompleteProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<ProfileGateResult> {
  const { data, error } = await supabase
    .from('users')
    .select('onboarding_status, profile_complete')
    .eq('id', userId)
    .maybeSingle<{ onboarding_status: string | null; profile_complete: boolean | null }>()

  if (error) {
    console.error('[auth/require-complete-profile] lookup failed', {
      userId,
      message: error.message,
      code: (error as { code?: string }).code,
    })
    return { ok: false, status: 503, error: 'profile_check_unavailable' }
  }

  // Primary gate: onboarding_status must be 'complete'
  if (data?.onboarding_status === 'complete') {
    return { ok: true }
  }

  // Legacy fallback: accounts that predate onboarding_status but have
  // profile_complete = true are still allowed through.
  if (data?.profile_complete === true) {
    return { ok: true }
  }

  // 403 rather than 401: the session is valid, the account is simply not
  // permitted to book yet. The client distinguishes these to decide between
  // re-authenticating and reopening the profile step.
  return { ok: false, status: 403, error: 'profile_incomplete' }
}
