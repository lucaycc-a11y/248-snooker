/**
 * Format phone number for display with spaces.
 * Pure display function - does not modify stored values.
 *
 * Examples:
 * - +85259114212 → +852 5911 4212
 * - 59114212 → 5911 4212
 */
export function formatPhoneDisplay(phone: string | null | undefined): string {
  if (!phone) return ''

  // Remove all spaces first
  const cleaned = phone.replace(/\s+/g, '')

  // Handle HK format with +852
  if (cleaned.startsWith('+852')) {
    const number = cleaned.slice(4)
    return `+852 ${number.slice(0, 4)} ${number.slice(4)}`
  }

  // Handle 8-digit HK local format
  if (cleaned.length === 8 && /^\d{8}$/.test(cleaned)) {
    return `${cleaned.slice(0, 4)} ${cleaned.slice(4)}`
  }

  // Return as-is if doesn't match expected formats
  return phone
}
