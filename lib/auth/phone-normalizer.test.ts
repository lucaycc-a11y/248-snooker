import { describe, it, expect } from 'vitest'
import { normalizeHkPhone, validateHkPhone, formatHkPhone } from './phone-normalizer'

describe('normalizeHkPhone', () => {
  describe('valid inputs', () => {
    it('accepts bare 8 digits with valid prefixes', () => {
      expect(normalizeHkPhone('51234567')).toBe('+85251234567')
      expect(normalizeHkPhone('61234567')).toBe('+85261234567')
      expect(normalizeHkPhone('91234567')).toBe('+85291234567')
      expect(normalizeHkPhone('70123456')).toBe('+85270123456')
    })

    it('accepts +852 prefix', () => {
      expect(normalizeHkPhone('+85291234567')).toBe('+85291234567')
      expect(normalizeHkPhone('+85251234567')).toBe('+85251234567')
    })

    it('accepts 852 prefix without +', () => {
      expect(normalizeHkPhone('85291234567')).toBe('+85291234567')
      expect(normalizeHkPhone('85251234567')).toBe('+85251234567')
    })

    it('strips spaces', () => {
      expect(normalizeHkPhone('9123 4567')).toBe('+85291234567')
      expect(normalizeHkPhone('+852 9123 4567')).toBe('+85291234567')
      expect(normalizeHkPhone('852 9123 4567')).toBe('+85291234567')
    })

    it('strips dashes', () => {
      expect(normalizeHkPhone('9123-4567')).toBe('+85291234567')
      expect(normalizeHkPhone('+852-9123-4567')).toBe('+85291234567')
    })

    it('strips parentheses', () => {
      expect(normalizeHkPhone('(852) 9123 4567')).toBe('+85291234567')
    })
  })

  describe('invalid inputs', () => {
    it('rejects null/undefined/empty', () => {
      expect(normalizeHkPhone(null)).toBe(null)
      expect(normalizeHkPhone(undefined)).toBe(null)
      expect(normalizeHkPhone('')).toBe(null)
      expect(normalizeHkPhone('   ')).toBe(null)
    })

    it('rejects 7 digits', () => {
      expect(normalizeHkPhone('9123456')).toBe(null)
    })

    it('rejects 9 digits', () => {
      expect(normalizeHkPhone('912345678')).toBe(null)
    })

    it('rejects local numbers starting 0 or 1', () => {
      expect(normalizeHkPhone('11234567')).toBe(null)
      expect(normalizeHkPhone('01234567')).toBe(null)
      expect(normalizeHkPhone('85212345678')).toBe(null) // 852 + local starting 1
    })

    it('rejects landlines and 4/8 prefixes (mobile-only policy)', () => {
      expect(normalizeHkPhone('21234567')).toBe(null)
      expect(normalizeHkPhone('31234567')).toBe(null)
      expect(normalizeHkPhone('46123456')).toBe(null)
      expect(normalizeHkPhone('84123456')).toBe(null)
      expect(normalizeHkPhone('+85246123456')).toBe(null)
      expect(normalizeHkPhone('85284123456')).toBe(null)
    })

    it('never strips 852 from a bare 8-digit number', () => {
      // Old regex removed the 852 and then judged the remaining 5 digits.
      expect(normalizeHkPhone('85212345')).toBe(null) // local starts 8: rejected as a whole
      expect(normalizeHkPhone('8521 2345')).toBe(null)
    })

    it('rejects non-HK country codes', () => {
      expect(normalizeHkPhone('+8613812345678')).toBe(null) // China
      expect(normalizeHkPhone('+447911123456')).toBe(null) // UK
      expect(normalizeHkPhone('+12025551234')).toBe(null) // US
    })

    it('rejects letters', () => {
      expect(normalizeHkPhone('9123abcd')).toBe(null)
      expect(normalizeHkPhone('abc')).toBe(null)
    })
  })

  describe('edge cases', () => {
    it('handles leading/trailing whitespace', () => {
      expect(normalizeHkPhone('  91234567  ')).toBe('+85291234567')
    })

    it('handles mixed formatting', () => {
      expect(normalizeHkPhone('+852 (9123) 4567')).toBe('+85291234567')
    })
  })
})

describe('validateHkPhone', () => {
  it('returns valid for correct numbers', () => {
    expect(validateHkPhone('91234567')).toEqual({ valid: true })
    expect(validateHkPhone('+85291234567')).toEqual({ valid: true })
    expect(validateHkPhone('9123 4567')).toEqual({ valid: true })
  })

  it('returns empty reason for null/empty', () => {
    expect(validateHkPhone(null)).toEqual({ valid: false, reason: 'empty' })
    expect(validateHkPhone('')).toEqual({ valid: false, reason: 'empty' })
    expect(validateHkPhone('   ')).toEqual({ valid: false, reason: 'empty' })
  })

  it('returns invalid_format for wrong length', () => {
    expect(validateHkPhone('9123456')).toEqual({ valid: false, reason: 'invalid_format' })
    expect(validateHkPhone('912345678')).toEqual({ valid: false, reason: 'invalid_format' })
  })

  it('returns non_hk for non-HK codes', () => {
    expect(validateHkPhone('+8613812345678')).toEqual({ valid: false, reason: 'non_hk' })
  })

  it('returns invalid_prefix for non-mobile prefixes', () => {
    for (const n of ['01234567', '11234567', '21234567', '31234567', '41234567', '81234567']) {
      expect(validateHkPhone(n)).toEqual({ valid: false, reason: 'invalid_prefix' })
    }
  })
})

describe('formatHkPhone', () => {
  it('formats E.164 to readable form', () => {
    expect(formatHkPhone('+85291234567')).toBe('+852 9123 4567')
    expect(formatHkPhone('+85251234567')).toBe('+852 5123 4567')
  })

  it('returns as-is for non-E.164', () => {
    expect(formatHkPhone('91234567')).toBe('91234567')
    expect(formatHkPhone('+8613812345678')).toBe('+8613812345678')
  })
})
