import { describe, it, expect } from 'vitest'
import { pricingRatesToPeriods } from './pricing'

describe('pricingRatesToPeriods', () => {
  it('parses valid 3-period config', () => {
    const rates = {
      morning: { base: 88, timeRange: '06:00-12:00' },
      afternoon: { base: 98, timeRange: '12:00-18:00' },
      evening: { base: 108, timeRange: '18:00-24:00' },
    }
    const periods = pricingRatesToPeriods(rates)
    expect(periods).toHaveLength(3)
    expect(periods[0]).toEqual({ id: 'morning', rate: 88, start: '06:00', end: '12:00', days: 'all' })
  })

  it('ignores extra scalar keys (currency, deposit, overstay)', () => {
    const rates = {
      morning: { base: 88, timeRange: '06:00-12:00' },
      currency: 'HKD',
      preauth_deposit: 500,
      overstay_per_15min: 50,
    }
    const periods = pricingRatesToPeriods(rates)
    expect(periods).toHaveLength(1)
    expect(periods[0].id).toBe('morning')
  })

  it('rejects entry with missing timeRange', () => {
    const rates = {
      morning: { base: 88 }, // missing timeRange
      afternoon: { base: 98, timeRange: '12:00-18:00' },
    }
    const periods = pricingRatesToPeriods(rates)
    // only afternoon should be included
    expect(periods).toHaveLength(1)
    expect(periods[0].id).toBe('afternoon')
  })

  it('rejects entry with invalid timeRange format', () => {
    const rates = {
      morning: { base: 88, timeRange: '6-12' }, // invalid format
      afternoon: { base: 98, timeRange: '12:00-18:00' },
    }
    const periods = pricingRatesToPeriods(rates)
    expect(periods).toHaveLength(1)
    expect(periods[0].id).toBe('afternoon')
  })

  it('rejects entry with null or non-object value', () => {
    const rates = {
      morning: null,
      afternoon: { base: 98, timeRange: '12:00-18:00' },
      evening: undefined,
    }
    const periods = pricingRatesToPeriods(rates)
    expect(periods).toHaveLength(1)
    expect(periods[0].id).toBe('afternoon')
  })

  it('returns defaults on null input', () => {
    const periods = pricingRatesToPeriods(null as any)
    expect(periods).toHaveLength(3)
  })

  it('returns defaults on empty object', () => {
    const periods = pricingRatesToPeriods({})
    expect(periods).toHaveLength(3)
  })

  it('rejects entry with non-numeric base', () => {
    const rates = {
      morning: { base: '88', timeRange: '06:00-12:00' }, // string instead of number
      afternoon: { base: 98, timeRange: '12:00-18:00' },
    }
    const periods = pricingRatesToPeriods(rates)
    expect(periods).toHaveLength(1)
    expect(periods[0].id).toBe('afternoon')
  })
})
