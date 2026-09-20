import { parsePhoneNumber, isValidPhoneNumber, type CountryCode } from 'libphonenumber-js'

export function normalizePhone(raw: string, defaultCountry: CountryCode = 'HK'): string | null {
  if (!raw) return null
  try {
    if (!isValidPhoneNumber(raw, defaultCountry)) return null
    return parsePhoneNumber(raw, defaultCountry).format('E.164')
  } catch {
    return null
  }
}

/**
 * Format phone number for display with spaces.
 * Converts E.164 format (+85259114212) to human-readable (+852 5911 4212).
 * Pure display formatting—does not change stored data.
 */
export function formatPhoneDisplay(phone: string): string {
  if (!phone) return phone

  try {
    // Handle E.164 format (+85259114212)
    const parsed = parsePhoneNumber(phone)
    if (parsed) {
      // Use INTERNATIONAL format which adds spaces
      return parsed.formatInternational()
    }
  } catch {
    // If parsing fails, fall back to simple HK formatting
  }

  // Fallback: if starts with +852, manually format HK number
  if (phone.startsWith('+852')) {
    const digits = phone.slice(4) // Remove +852
    if (digits.length === 8) {
      return `+852 ${digits.slice(0, 4)} ${digits.slice(4)}`
    }
  }

  return phone
}
