// Shared timing constants for the account-change flows.
// Kept in a client-safe module (no server-only imports) so both the member
// settings UI and the API routes read the same numbers.
//
// These are security/UX timings, not business values — they intentionally do
// not live in the `config` table.

/** Lifetime of an emailed change link, in minutes. */
export const CHANGE_TOKEN_TTL_MINUTES = 30

/** Visible cooldown after requesting a change link, in seconds. */
export const CHANGE_REQUEST_COOLDOWN = 60

/** Max change-link requests per user per hour. */
export const CHANGE_REQUEST_MAX_PER_HOUR = 3

/** Digits in a phone-verification OTP. */
export const OTP_LENGTH = 6

/** Visible cooldown between OTP sends, in seconds. */
export const OTP_RESEND_COOLDOWN = 60

/** Wrong OTP attempts allowed before the attempt is locked out. */
export const OTP_MAX_ATTEMPTS = 5

/** Max OTP sends per user (and per phone) per hour. */
export const OTP_MAX_SENDS_PER_HOUR = 5
