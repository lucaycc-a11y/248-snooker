// Single source of truth for password policy. Imported by both the signup/reset
// routes (authoritative check) and the client strength meter (feedback only) so
// the browser can never disagree with what the server will accept.

export const PASSWORD_MIN_LENGTH = 8
export const PASSWORD_MAX_LENGTH = 72 // bcrypt truncates beyond this; reject loudly instead.

export type PasswordReason = 'too_short' | 'too_long' | 'no_upper' | 'no_lower' | 'no_digit'

export type PasswordValidation = { ok: true } | { ok: false; reasons: PasswordReason[] }

export function validatePassword(value: unknown): PasswordValidation {
  if (typeof value !== 'string') return { ok: false, reasons: ['too_short'] }

  const reasons: PasswordReason[] = []
  if (value.length < PASSWORD_MIN_LENGTH) reasons.push('too_short')
  if (value.length > PASSWORD_MAX_LENGTH) reasons.push('too_long')
  if (!/[A-Z]/.test(value)) reasons.push('no_upper')
  if (!/[a-z]/.test(value)) reasons.push('no_lower')
  if (!/\d/.test(value)) reasons.push('no_digit')

  return reasons.length === 0 ? { ok: true } : { ok: false, reasons }
}

// 0..4, for the strength meter only. Never gate acceptance on this — a value can
// score 4 and still fail validatePassword (e.g. 7 chars with every class), and
// the meter must not imply a rule the server does not enforce.
export function scorePassword(value: string): 0 | 1 | 2 | 3 | 4 {
  if (!value) return 0

  let score = 0
  if (value.length >= PASSWORD_MIN_LENGTH) score += 1
  if (value.length >= 12) score += 1
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score += 1
  if (/\d/.test(value) && /[^A-Za-z0-9]/.test(value)) score += 1

  return Math.min(score, 4) as 0 | 1 | 2 | 3 | 4
}
