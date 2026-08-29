// Allowed transitions for an email-backed registration attempt.
//
// Ordering is email first, then phone. A brand-new account is only ever
// bootstrapped from a verified email address: an unknown phone number can log in
// to an existing account but must never create one, so there is no phone-first
// entry point in this state machine.
//
// pending -> email_verified -> phone_verified -> completed
//                (any state) -> expired

export type SignupStatus = 'pending' | 'email_verified' | 'phone_verified' | 'completed' | 'expired'

export type SignupMethod = 'email'

export type FinalizableAttempt = {
  status: SignupStatus
  email_verified_at: string | null
  phone_verified_at: string | null
  expires_at: string
}

export function isExpired(expiresAt: string, now: Date = new Date()): boolean {
  const parsed = new Date(expiresAt).getTime()
  return !Number.isFinite(parsed) || parsed <= now.getTime()
}

// Step 1: the hashed email code may only be redeemed while the attempt is pending.
export function canVerifyEmail(status: SignupStatus): boolean {
  return status === 'pending'
}

// Step 2: the SMS code may only be redeemed once the email is already verified.
// This is what stops a caller from skipping straight to the phone step.
export function canVerifyPhone(status: SignupStatus): boolean {
  return status === 'email_verified'
}

// Step 3: account creation requires both verification timestamps to be present.
// The database constraint on public.users enforces the same invariant; this is
// the application-side half so we never even attempt an invalid write.
export function canFinalize(attempt: FinalizableAttempt, now: Date = new Date()): boolean {
  return (
    attempt.status === 'phone_verified' &&
    attempt.email_verified_at !== null &&
    attempt.phone_verified_at !== null &&
    !isExpired(attempt.expires_at, now)
  )
}
