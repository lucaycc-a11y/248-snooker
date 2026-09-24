/**
 * Contact input validation utilities
 * Validates phone numbers and email addresses for auth flow
 */

import { normalizeHkPhone } from './profile'

export type ContactType = 'phone' | 'email' | 'unknown'

export interface ContactValidation {
  type: ContactType
  valid: boolean
  normalized: string | null
  error?: string
}

/**
 * Detect contact type from input string
 */
export function detectContactType(input: string): ContactType {
  if (!input) return 'unknown'

  const trimmed = input.trim()

  // Phone: starts with + or digit
  if (/^[+\d]/.test(trimmed)) {
    return 'phone'
  }

  // Email: contains @
  if (trimmed.includes('@')) {
    return 'email'
  }

  return 'unknown'
}

/**
 * Validate email format
 */
export function validateEmail(email: string): boolean {
  const trimmed = email.trim()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)
}

/**
 * Validate HK phone number
 * Must be 8 digits, starting with 2/3/5/6/7/8/9
 * Accepts spaces which are stripped before validation
 */
export function validateHkPhone(input: string): boolean {
  const normalized = normalizeHkPhone(input)
  return normalized !== null
}

/**
 * Validate contact input and return structured result
 */
export function validateContact(input: string): ContactValidation {
  const trimmed = input.trim()
  const type = detectContactType(trimmed)

  if (type === 'unknown') {
    return {
      type: 'unknown',
      valid: false,
      normalized: null,
      error: 'Please enter a phone number or email address',
    }
  }

  if (type === 'email') {
    const valid = validateEmail(trimmed)
    return {
      type: 'email',
      valid,
      normalized: valid ? trimmed : null,
      error: valid ? undefined : 'Please enter a valid email address',
    }
  }

  // type === 'phone'
  const normalized = normalizeHkPhone(trimmed)
  return {
    type: 'phone',
    valid: normalized !== null,
    normalized,
    error: normalized ? undefined : 'Please enter a valid Hong Kong phone number (8 digits)',
  }
}

/**
 * Format HK phone for display (masks middle digits)
 * +85259114212 → +852 ****4212
 */
export function maskHkPhone(e164: string): string {
  if (!e164.startsWith('+852') || e164.length !== 12) {
    return e164
  }

  const digits = e164.slice(4) // Remove +852
  return `+852 ****${digits.slice(-4)}`
}

/**
 * Format email for display (masks local part)
 * test@example.com → t***@example.com
 */
export function maskEmail(email: string): string {
  const atIndex = email.indexOf('@')
  if (atIndex <= 0) {
    return email
  }

  const local = email.slice(0, atIndex)
  const domain = email.slice(atIndex)

  if (local.length <= 1) {
    return email
  }

  return `${local[0]}***${domain}`
}
