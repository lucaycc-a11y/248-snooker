import { describe, it, expect } from 'vitest'
import {
  detectContactType,
  validateEmail,
  validateHkPhone,
  validateContact,
  maskHkPhone,
  maskEmail,
} from '../contact-validation'

describe('detectContactType', () => {
  it('detects phone numbers starting with digit', () => {
    expect(detectContactType('59114212')).toBe('phone')
    expect(detectContactType('2123 4567')).toBe('phone')
  })

  it('detects phone numbers starting with +', () => {
    expect(detectContactType('+85259114212')).toBe('phone')
  })

  it('detects email addresses', () => {
    expect(detectContactType('test@example.com')).toBe('email')
    expect(detectContactType('user.name@domain.co.uk')).toBe('email')
  })

  it('returns unknown for empty or ambiguous input', () => {
    expect(detectContactType('')).toBe('unknown')
    expect(detectContactType('abc')).toBe('unknown')
  })
})

describe('validateEmail', () => {
  it('validates correct email formats', () => {
    expect(validateEmail('test@example.com')).toBe(true)
    expect(validateEmail('user.name+tag@example.co.uk')).toBe(true)
  })

  it('rejects invalid email formats', () => {
    expect(validateEmail('invalid')).toBe(false)
    expect(validateEmail('no@domain')).toBe(false)
    expect(validateEmail('@example.com')).toBe(false)
    expect(validateEmail('test@')).toBe(false)
  })

  it('handles whitespace', () => {
    expect(validateEmail('  test@example.com  ')).toBe(true)
  })
})

describe('validateHkPhone', () => {
  it('validates correct HK phone numbers', () => {
    expect(validateHkPhone('59114212')).toBe(true)
    expect(validateHkPhone('2123 4567')).toBe(true)
    expect(validateHkPhone('5911 4212')).toBe(true)
    expect(validateHkPhone('+85259114212')).toBe(true)
  })

  it('validates all valid starting digits', () => {
    expect(validateHkPhone('21234567')).toBe(true) // 2
    expect(validateHkPhone('31234567')).toBe(true) // 3
    expect(validateHkPhone('51234567')).toBe(true) // 5
    expect(validateHkPhone('61234567')).toBe(true) // 6
    expect(validateHkPhone('71234567')).toBe(true) // 7
    expect(validateHkPhone('81234567')).toBe(true) // 8
    expect(validateHkPhone('91234567')).toBe(true) // 9
  })

  it('rejects invalid HK phone numbers', () => {
    expect(validateHkPhone('1234567')).toBe(false) // 7 digits
    expect(validateHkPhone('123456789')).toBe(false) // 9 digits
    expect(validateHkPhone('11234567')).toBe(false) // starts with 1
    expect(validateHkPhone('41234567')).toBe(false) // starts with 4
    expect(validateHkPhone('abcd1234')).toBe(false) // contains letters
  })
})

describe('validateContact', () => {
  it('validates phone numbers with normalization', () => {
    const result = validateContact('59114212')
    expect(result.type).toBe('phone')
    expect(result.valid).toBe(true)
    expect(result.normalized).toBe('+85259114212')
  })

  it('validates emails', () => {
    const result = validateContact('test@example.com')
    expect(result.type).toBe('email')
    expect(result.valid).toBe(true)
    expect(result.normalized).toBe('test@example.com')
  })

  it('returns error for invalid input', () => {
    const result = validateContact('invalid')
    expect(result.type).toBe('unknown')
    expect(result.valid).toBe(false)
    expect(result.error).toBeDefined()
  })
})

describe('maskHkPhone', () => {
  it('masks HK phone numbers', () => {
    expect(maskHkPhone('+85259114212')).toBe('+852 ****4212')
  })

  it('returns unchanged if not valid format', () => {
    expect(maskHkPhone('invalid')).toBe('invalid')
    expect(maskHkPhone('+1234567890')).toBe('+1234567890')
  })
})

describe('maskEmail', () => {
  it('masks email addresses', () => {
    expect(maskEmail('test@example.com')).toBe('t***@example.com')
    expect(maskEmail('longname@domain.co.uk')).toBe('l***@domain.co.uk')
  })

  it('handles short local parts', () => {
    expect(maskEmail('a@example.com')).toBe('a@example.com')
  })

  it('returns unchanged if invalid format', () => {
    expect(maskEmail('invalid')).toBe('invalid')
  })
})
