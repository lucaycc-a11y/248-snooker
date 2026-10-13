/**
 * Unit tests for price computation.
 */

import { describe, it, expect } from 'vitest'
import { computeBookingPrice, UnmappedHourError } from '@/lib/pricing/compute'
import type { Pricing } from '@/lib/pricing/config'

const TEST_PRICING: Pricing = {
  periods: [
    { id: 'morning', base: 88, timeRange: '06:00-12:00', startHour: 6, endHour: 12 },
    { id: 'afternoon', base: 98, timeRange: '12:00-18:00', startHour: 12, endHour: 18 },
    { id: 'evening', base: 108, timeRange: '18:00-24:00', startHour: 18, endHour: 24 },
  ],
  currency: 'HKD',
  preauth_deposit: 500,
  overstay_per_15min: 50,
}

describe('computeBookingPrice', () => {
  it('should compute morning booking (06:00-12:00) as 6 × 88 = 528', () => {
    const result = computeBookingPrice('2026-10-15', '06:00', '12:00', TEST_PRICING)
    expect(result.subtotal).toBe(528)
    expect(result.breakdown).toHaveLength(6)
    expect(result.breakdown.every((b) => b.period.id === 'morning')).toBe(true)
  })

  it('should compute cross-period booking (11:00-13:00) as 88 + 98 = 186, no discount', () => {
    const result = computeBookingPrice('2026-10-15', '11:00', '13:00', TEST_PRICING)
    expect(result.subtotal).toBe(186)
    expect(result.breakdown).toHaveLength(2)
    expect(result.breakdown[0].period.id).toBe('morning')
    expect(result.breakdown[0].rate).toBe(88)
    expect(result.breakdown[1].period.id).toBe('afternoon')
    expect(result.breakdown[1].rate).toBe(98)
  })

  it('should compute afternoon-to-evening booking (17:00-19:00) as 98 + 108 = 206', () => {
    const result = computeBookingPrice('2026-10-15', '17:00', '19:00', TEST_PRICING)
    expect(result.subtotal).toBe(206)
    expect(result.breakdown).toHaveLength(2)
    expect(result.breakdown[0].period.id).toBe('afternoon')
    expect(result.breakdown[0].rate).toBe(98)
    expect(result.breakdown[1].period.id).toBe('evening')
    expect(result.breakdown[1].rate).toBe(108)
  })

  it('should compute single evening hour (23:00-24:00) as 108', () => {
    const result = computeBookingPrice('2026-10-15', '23:00', '24:00', TEST_PRICING)
    expect(result.subtotal).toBe(108)
    expect(result.breakdown).toHaveLength(1)
    expect(result.breakdown[0].period.id).toBe('evening')
    expect(result.breakdown[0].rate).toBe(108)
  })

  it('should throw UnmappedHourError for hour with no period (e.g., 05:00)', () => {
    expect(() => computeBookingPrice('2026-10-15', '05:00', '06:00', TEST_PRICING)).toThrow(
      UnmappedHourError,
    )
  })

  it('should throw UnmappedHourError for hour after midnight (24:00+)', () => {
    expect(() => computeBookingPrice('2026-10-15', '00:00', '01:00', TEST_PRICING)).toThrow(
      UnmappedHourError,
    )
  })
})
