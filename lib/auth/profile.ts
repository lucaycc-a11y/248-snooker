// Server + client shared profile validation. The mandatory profile-completion
// step (first sign-in) requires name + email + phone for EVERY method — including
// SMS users (who lack email) and Apple/Google users (who lack a verified phone).
// These run client-side for instant feedback AND server-side in /api/profile/complete
// as the authoritative check (never trust the client).

export type ProfileInput = {
  name: string
  email: string
  phone: string
}

export type ValidatedProfile = {
  display_name: string
  email: string
  phone: string
}

export type ProfileValidation =
  | { ok: true; value: ValidatedProfile }
  | { ok: false; field: 'name' | 'email' | 'phone'; error: string }

/**
 * Normalize a Hong Kong phone number to E.164 (+852XXXXXXXX), or null if invalid.
 * Accepts optional +852/852 prefix and common separators. HK numbers are 8 digits
 * and start 2–9 (landline 2/3, mobile 5/6/9, newer ranges 4/7/8).
 */
export function normalizeHkPhone(raw: string): string | null {
  if (!raw) return null
  const digits = raw.replace(/[\s\-()]/g, '').replace(/^\+?852/, '')
  if (!/^[2-9]\d{7}$/.test(digits)) return null
  return `+852${digits}`
}

// Pragmatic email check — rejects the obvious-invalid without the false negatives
// of an over-strict RFC regex.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateProfile(input: Partial<ProfileInput>): ProfileValidation {
  const name = (input.name ?? '').trim()
  if (name.length < 1 || name.length > 100) {
    return { ok: false, field: 'name', error: 'name_required' }
  }

  const email = (input.email ?? '').trim().toLowerCase()
  if (email.length > 254 || !EMAIL_RE.test(email)) {
    return { ok: false, field: 'email', error: 'email_invalid' }
  }

  const phone = normalizeHkPhone(input.phone ?? '')
  if (!phone) {
    return { ok: false, field: 'phone', error: 'phone_invalid' }
  }

  return { ok: true, value: { display_name: name, email, phone } }
}
