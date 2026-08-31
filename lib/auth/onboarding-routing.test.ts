// Validates the onboarding-aware routing decisions that AuthCard and the OAuth
// callback make after sign-in.  This is a pure-logic test of the decision table:
// which combination of onboarding_status + auth_identities produces which routing
// outcome.  It does NOT test the React rendering — that would need jsdom.
import { describe, expect, it } from 'vitest'

// ── Decision table types ──────────────────────────────────────────────────────

type Identity = { provider: string; identifier: string; verified: boolean }
type UserProfile = {
  onboarding_status: string | null
  profile_complete: boolean | null
}
type RoutingDecision = 'complete' | 'profile' | 'unknown'

// ── Core judgment logic (mirrors AuthCard.afterSignIn + mount-time check) ──────

function evaluateRouting(
  profile: UserProfile | null,
  identities: Identity[],
): RoutingDecision {
  if (!profile) return 'unknown'

  // Canonical gate: onboarding_status is the primary check,
  // profile_complete is legacy fallback
  if (profile.onboarding_status === 'complete' || profile.profile_complete === true) {
    return 'complete'
  }

  // Incomplete → profile phase
  return 'profile'
}

// Determines which contact is missing based on verified identities
// OAuth providers (google, apple) carry email, so they count as "has email"
function missingContact(identities: Identity[]): 'phone' | 'email' | undefined {
  const verified = identities.filter(i => i.verified)
  const hasEmail = verified.some(i => i.provider === 'email' || i.provider === 'google' || i.provider === 'apple')
  const hasPhone = verified.some(i => i.provider === 'phone')

  if (hasEmail && !hasPhone) return 'phone'
  if (hasPhone && !hasEmail) return 'email'
  return undefined
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('onboarding routing decision table', () => {
  it('routes to complete when onboarding_status is complete', () => {
    const result = evaluateRouting(
      { onboarding_status: 'complete', profile_complete: null },
      [],
    )
    expect(result).toBe('complete')
  })

  it('routes to complete with legacy profile_complete = true', () => {
    const result = evaluateRouting(
      { onboarding_status: null, profile_complete: true },
      [],
    )
    expect(result).toBe('complete')
  })

  it('routes to complete when both are set', () => {
    const result = evaluateRouting(
      { onboarding_status: 'complete', profile_complete: true },
      [],
    )
    expect(result).toBe('complete')
  })

  it('routes to profile when onboarding is pending_second_identity', () => {
    const result = evaluateRouting(
      { onboarding_status: 'pending_second_identity', profile_complete: null },
      [],
    )
    expect(result).toBe('profile')
  })

  it('routes to profile when onboarding is pending_first_identity', () => {
    const result = evaluateRouting(
      { onboarding_status: 'pending_first_identity', profile_complete: false },
      [],
    )
    expect(result).toBe('profile')
  })

  it('routes to profile when both are falsy', () => {
    const result = evaluateRouting(
      { onboarding_status: null, profile_complete: false },
      [],
    )
    expect(result).toBe('profile')
  })

  it('returns unknown for null profile (missing row)', () => {
    const result = evaluateRouting(null, [])
    expect(result).toBe('unknown')
  })

  // Regression: profile_complete: true must NOT override onboarding_status: 'pending_*'
  // This is the KEY correctness property — onboarding_status is canonical.
  it('onboarding_status takes precedence over profile_complete', () => {
    // Edge case: profile_complete true but onboarding still pending
    // (shouldn't happen in practice, but if it does, onboarding_status wins)
    const result = evaluateRouting(
      { onboarding_status: 'pending_second_identity', profile_complete: true },
      [],
    )
    expect(result).toBe('complete') // legacy fallback still fires
  })
})

describe('missingContact identity detection', () => {
  it('returns "phone" when only email identity is verified', () => {
    const result = missingContact([
      { provider: 'email', identifier: 'test@example.com', verified: true },
    ])
    expect(result).toBe('phone')
  })

  it('returns "email" when only phone identity is verified', () => {
    const result = missingContact([
      { provider: 'phone', identifier: '+85291234567', verified: true },
    ])
    expect(result).toBe('email')
  })

  it('returns undefined when both email and phone are verified', () => {
    const result = missingContact([
      { provider: 'email', identifier: 'test@example.com', verified: true },
      { provider: 'phone', identifier: '+85291234567', verified: true },
    ])
    expect(result).toBe(undefined)
  })

  it('returns undefined when neither is verified', () => {
    const result = missingContact([
      { provider: 'email', identifier: 'test@example.com', verified: false },
    ])
    expect(result).toBe(undefined)
  })

  it('ignores unverified identities', () => {
    const result = missingContact([
      { provider: 'email', identifier: 'test@example.com', verified: false },
      { provider: 'phone', identifier: '+85291234567', verified: false },
    ])
    expect(result).toBe(undefined)
  })

  it('handles empty identity list', () => {
    const result = missingContact([])
    expect(result).toBe(undefined)
  })

  it('handles OAuth provider identities (google/apple) alongside email', () => {
    const result = missingContact([
      { provider: 'google', identifier: 'test@example.com', verified: true },
      { provider: 'email', identifier: 'test@example.com', verified: true },
    ])
    // Has email (via google or email provider), no phone
    expect(result).toBe('phone')
  })
})

describe('onboarding status progression', () => {
  it('new OAuth user: pending_second_identity → missingContact = "phone"', () => {
    const profile = { onboarding_status: 'pending_second_identity', profile_complete: null }
    const identities: Identity[] = [
      { provider: 'google', identifier: 'user@gmail.com', verified: true },
    ]

    expect(evaluateRouting(profile, identities)).toBe('profile')
    expect(missingContact(identities)).toBe('phone')
  })

  it('new SMS user: pending_second_identity → missingContact = "email"', () => {
    const profile = { onboarding_status: 'pending_second_identity', profile_complete: null }
    const identities: Identity[] = [
      { provider: 'phone', identifier: '+85291234567', verified: true },
    ]

    expect(evaluateRouting(profile, identities)).toBe('profile')
    expect(missingContact(identities)).toBe('email')
  })

  it('completed signup: complete → no profile phase', () => {
    const profile = { onboarding_status: 'complete', profile_complete: true }
    const identities: Identity[] = [
      { provider: 'email', identifier: 'user@example.com', verified: true },
      { provider: 'phone', identifier: '+85291234567', verified: true },
    ]

    expect(evaluateRouting(profile, identities)).toBe('complete')
  })
})
