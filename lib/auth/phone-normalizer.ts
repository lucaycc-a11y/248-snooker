/**
 * Unified phone normalizer for Space8 — HK mobile numbers only
 *
 * SINGLE SOURCE OF TRUTH for phone validation and E.164 normalization.
 * Used by: login flows, profile completion, phone change, admin tools.
 *
 * Accepts:
 * - Bare 8 digits with an accepted mobile prefix (5/6/7/9): 91234567
 * - +852 prefix: +85291234567
 * - 852 prefix (no +): 85291234567
 * - Spaces, dashes, parentheses: +852 9123 4567, 9123-4567, (852) 9123 4567
 *
 * Rejects:
 * - 7 or 9+ digits
 * - Local number starting 0–4 or 8 (landlines, 4- and 8-prefix numbers)
 * - Non-HK country codes (+86, +1, etc.)
 * - Letters or invalid characters (after stripping formatting)
 *
 * Unlike the previous regex, a bare 8-digit number that happens to start with
 * 852 (e.g. 8521 2345) is treated as a local number, not as a country code.
 *
 * Returns E.164 format (+85291234567) or null if invalid.
 */

// Accepted first digits of the 8-digit local number. Owner decision 2026-10-06:
// mobile only, 5/6/7/9. Landlines (2/3), 4 and 8 are rejected. All existing
// stored numbers start 5 or 6, so nobody is locked out. Change this list only.
const HK_MOBILE_PREFIXES = ['5', '6', '7', '9']

export function normalizeHkPhone(input: string | null | undefined): string | null {
  if (!input) return null

  // Strip all non-digits except leading +
  const trimmed = input.trim()
  const hasPlus = trimmed.startsWith('+')
  const digitsOnly = trimmed.replace(/\D/g, '')

  // Empty after stripping
  if (!digitsOnly) return null

  // Case 1: +852XXXXXXXX or 852XXXXXXXX (11 digits, starts with 852)
  if (digitsOnly.length === 11 && digitsOnly.startsWith('852')) {
    const localPart = digitsOnly.slice(3) // last 8 digits
    if (localPart.length !== 8) return null
    if (!HK_MOBILE_PREFIXES.includes(localPart[0])) return null
    return `+852${localPart}`
  }

  // Case 2: Bare 8 digits (XXXXXXXX)
  if (digitsOnly.length === 8) {
    if (!HK_MOBILE_PREFIXES.includes(digitsOnly[0])) return null
    return `+852${digitsOnly}`
  }

  // Case 3: Already E.164 (+852XXXXXXXX, 12 chars with +)
  if (hasPlus && digitsOnly.length === 11 && digitsOnly.startsWith('852')) {
    const localPart = digitsOnly.slice(3)
    if (localPart.length !== 8) return null
    if (!HK_MOBILE_PREFIXES.includes(localPart[0])) return null
    return `+852${localPart}`
  }

  // Reject: wrong length, non-HK code, invalid prefix
  return null
}

/**
 * Validate a phone number string for UI error messages.
 * Returns { valid: true } or { valid: false, reason: 'key' }
 * where reason is a translation key for the specific error.
 */
export function validateHkPhone(input: string | null | undefined): {
  valid: boolean
  reason?: 'empty' | 'invalid_format' | 'invalid_prefix' | 'non_hk'
} {
  if (!input || !input.trim()) {
    return { valid: false, reason: 'empty' }
  }

  const trimmed = input.trim()
  const digitsOnly = trimmed.replace(/\D/g, '')

  if (!digitsOnly) {
    return { valid: false, reason: 'invalid_format' }
  }

  // If more than 11 digits, it's likely a non-HK number
  if (digitsOnly.length > 11) {
    return { valid: false, reason: 'non_hk' }
  }

  // Check length (must resolve to 8-digit local or 11-digit with 852)
  if (digitsOnly.length !== 8 && digitsOnly.length !== 11) {
    return { valid: false, reason: 'invalid_format' }
  }

  // If 11 digits, must start with 852
  if (digitsOnly.length === 11 && !digitsOnly.startsWith('852')) {
    return { valid: false, reason: 'non_hk' }
  }

  // Check HK mobile prefix
  const localPart = digitsOnly.length === 11 ? digitsOnly.slice(3) : digitsOnly
  if (!HK_MOBILE_PREFIXES.includes(localPart[0])) {
    return { valid: false, reason: 'invalid_prefix' }
  }

  return { valid: true }
}

/**
 * Format a normalized phone number for display.
 * Input: +85291234567 (E.164)
 * Output: +852 9123 4567 (formatted for readability)
 */
export function formatHkPhone(e164: string): string {
  if (!e164.startsWith('+852') || e164.length !== 12) {
    return e164 // Return as-is if not valid E.164
  }
  const local = e164.slice(4) // remove +852
  return `+852 ${local.slice(0, 4)} ${local.slice(4)}`
}
