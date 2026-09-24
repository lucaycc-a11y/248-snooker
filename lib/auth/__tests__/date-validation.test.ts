import { describe, it, expect } from 'vitest'
import {
  validateDateOfBirth,
  isLeapYear,
  getDaysInMonth,
} from '../date-validation'

describe('validateDateOfBirth', () => {
  it('validates correct dates', () => {
    const result = validateDateOfBirth(15, 6, 1990)
    expect(result.valid).toBe(true)
    expect(result.dateString).toBe('1990-06-15')
  })

  it('validates dates on February 29 in leap years', () => {
    const result = validateDateOfBirth(29, 2, 2000)
    expect(result.valid).toBe(true)
    expect(result.dateString).toBe('2000-02-29')
  })

  it('rejects February 29 in non-leap years', () => {
    const result = validateDateOfBirth(29, 2, 2001)
    expect(result.valid).toBe(false)
    expect(result.error).toBeDefined()
  })

  it('rejects dates before 1900', () => {
    const result = validateDateOfBirth(1, 1, 1899)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('1900')
  })

  it('rejects future dates', () => {
    const futureYear = new Date().getFullYear() + 1
    const result = validateDateOfBirth(1, 1, futureYear)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('future')
  })

  it('rejects invalid months', () => {
    expect(validateDateOfBirth(15, 0, 1990).valid).toBe(false)
    expect(validateDateOfBirth(15, 13, 1990).valid).toBe(false)
  })

  it('rejects invalid days', () => {
    expect(validateDateOfBirth(0, 6, 1990).valid).toBe(false)
    expect(validateDateOfBirth(32, 6, 1990).valid).toBe(false)
  })

  it('rejects invalid dates (31st of months with 30 days)', () => {
    expect(validateDateOfBirth(31, 4, 1990).valid).toBe(false) // April
    expect(validateDateOfBirth(31, 6, 1990).valid).toBe(false) // June
    expect(validateDateOfBirth(31, 9, 1990).valid).toBe(false) // September
    expect(validateDateOfBirth(31, 11, 1990).valid).toBe(false) // November
  })

  it('accepts valid dates at boundary', () => {
    const currentYear = new Date().getFullYear()
    const today = new Date()
    const result = validateDateOfBirth(
      today.getDate(),
      today.getMonth() + 1,
      currentYear
    )
    expect(result.valid).toBe(true)
  })
})

describe('isLeapYear', () => {
  it('identifies leap years correctly', () => {
    expect(isLeapYear(2000)).toBe(true) // divisible by 400
    expect(isLeapYear(2004)).toBe(true) // divisible by 4, not 100
    expect(isLeapYear(2020)).toBe(true)
  })

  it('identifies non-leap years correctly', () => {
    expect(isLeapYear(1900)).toBe(false) // divisible by 100, not 400
    expect(isLeapYear(2001)).toBe(false) // not divisible by 4
    expect(isLeapYear(2100)).toBe(false)
  })
})

describe('getDaysInMonth', () => {
  it('returns correct days for each month', () => {
    expect(getDaysInMonth(1, 2020)).toBe(31) // January
    expect(getDaysInMonth(2, 2020)).toBe(29) // February (leap year)
    expect(getDaysInMonth(2, 2021)).toBe(28) // February (non-leap year)
    expect(getDaysInMonth(3, 2020)).toBe(31) // March
    expect(getDaysInMonth(4, 2020)).toBe(30) // April
    expect(getDaysInMonth(5, 2020)).toBe(31) // May
    expect(getDaysInMonth(6, 2020)).toBe(30) // June
    expect(getDaysInMonth(7, 2020)).toBe(31) // July
    expect(getDaysInMonth(8, 2020)).toBe(31) // August
    expect(getDaysInMonth(9, 2020)).toBe(30) // September
    expect(getDaysInMonth(10, 2020)).toBe(31) // October
    expect(getDaysInMonth(11, 2020)).toBe(30) // November
    expect(getDaysInMonth(12, 2020)).toBe(31) // December
  })
})
