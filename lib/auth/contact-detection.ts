// Contact format detection and normalization utilities
// Used by AuthCard to determine if input is email or phone

/**
 * Detects if the input string is an email address.
 * Accepts standard email formats including international domains.
 */
export function isEmail(input: string): boolean {
  const trimmed = input.trim()
  // Basic email pattern: local@domain with at least one dot in domain
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailPattern.test(trimmed)
}

/**
 * Detects if the input string is a Hong Kong phone number.
 * Accepts: +8521234567, 85212345678, 12345678
 */
export function isHkPhone(input: string): boolean {
  const trimmed = input.trim().replace(/[\s-]/g, '') // Remove spaces and dashes

  // 8 digits only
  if (/^\d{8}$/.test(trimmed)) {
    return true
  }

  // 852 prefix + 8 digits
  if (/^852\d{8}$/.test(trimmed)) {
    return true
  }

  // +852 prefix + 8 digits
  if (/^\+852\d{8}$/.test(trimmed)) {
    return true
  }

  return false
}

/**
 * Extracts and normalizes a phone number from various input formats.
 * Returns E.164 format (+8521234567) or empty string if invalid.
 */
export function extractPhoneNumber(input: string): string {
  const trimmed = input.trim().replace(/[\s-]/g, '')

  // Already in E.164 format
  if (/^\+852\d{8}$/.test(trimmed)) {
    return trimmed
  }

  // 852 prefix
  if (/^852\d{8}$/.test(trimmed)) {
    return '+' + trimmed
  }

  // 8 digits only
  if (/^\d{8}$/.test(trimmed)) {
    return '+852' + trimmed
  }

  return ''
}

/**
 * Determines the contact type from user input.
 * Returns 'email', 'phone', or 'unknown'.
 */
export function detectContactType(input: string): 'email' | 'phone' | 'unknown' {
  if (isEmail(input)) {
    return 'email'
  }

  if (isHkPhone(input)) {
    return 'phone'
  }

  return 'unknown'
}
