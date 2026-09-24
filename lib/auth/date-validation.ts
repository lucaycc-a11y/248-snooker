/**
 * Date of birth validation utilities
 */

export interface DateValidation {
  valid: boolean
  error?: string
  dateString?: string // YYYY-MM-DD format
}

/**
 * Validate date of birth
 * Requirements:
 * - Must be a real date (including leap years)
 * - Not in the future
 * - Not before 1900-01-01
 * - No age restriction (as per requirements)
 */
export function validateDateOfBirth(
  day: number,
  month: number,
  year: number
): DateValidation {
  // Basic range checks
  if (year < 1900) {
    return { valid: false, error: 'Year must not be earlier than 1900' }
  }

  const currentYear = new Date().getFullYear()
  if (year > currentYear) {
    return { valid: false, error: 'Date of birth cannot be in the future' }
  }

  if (month < 1 || month > 12) {
    return { valid: false, error: 'Month must be between 1 and 12' }
  }

  if (day < 1 || day > 31) {
    return { valid: false, error: 'Day must be between 1 and 31' }
  }

  // Check if date is valid (including leap years)
  const dateObj = new Date(year, month - 1, day)
  if (
    dateObj.getDate() !== day ||
    dateObj.getMonth() !== month - 1 ||
    dateObj.getFullYear() !== year
  ) {
    return { valid: false, error: 'Please enter a valid date' }
  }

  // Check not in future
  if (dateObj > new Date()) {
    return { valid: false, error: 'Date of birth cannot be in the future' }
  }

  // Format as YYYY-MM-DD
  const dateString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

  return { valid: true, dateString }
}

/**
 * Check if a year is a leap year
 */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

/**
 * Get maximum days in a month
 */
export function getDaysInMonth(month: number, year: number): number {
  if (month === 2) {
    return isLeapYear(year) ? 29 : 28
  }
  if ([4, 6, 9, 11].includes(month)) {
    return 30
  }
  return 31
}
