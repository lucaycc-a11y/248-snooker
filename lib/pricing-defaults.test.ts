/**
 * Test that pricing defaults are consistent across the codebase.
 * Enforces the single source of truth: 88/98/108 HKD at 06-12/12-18/18-24.
 */

import { describe, test, expect } from 'vitest'
import { DEFAULT_PERIODS } from '@/lib/data/pricing'

describe('Pricing defaults consistency', () => {
  test('DEFAULT_PERIODS must be exactly 88/98/108 at 06-12/12-18/18-24', () => {
    expect(DEFAULT_PERIODS).toHaveLength(3)

    expect(DEFAULT_PERIODS[0].id).toBe('morning')
    expect(DEFAULT_PERIODS[0].rate).toBe(88)
    expect(DEFAULT_PERIODS[0].start).toBe('06:00')
    expect(DEFAULT_PERIODS[0].end).toBe('12:00')

    expect(DEFAULT_PERIODS[1].id).toBe('afternoon')
    expect(DEFAULT_PERIODS[1].rate).toBe(98)
    expect(DEFAULT_PERIODS[1].start).toBe('12:00')
    expect(DEFAULT_PERIODS[1].end).toBe('18:00')

    expect(DEFAULT_PERIODS[2].id).toBe('evening')
    expect(DEFAULT_PERIODS[2].rate).toBe(108)
    expect(DEFAULT_PERIODS[2].start).toBe('18:00')
    expect(DEFAULT_PERIODS[2].end).toBe('24:00')
  })

  test('No other pricing values are allowed as defaults', () => {
    // This test fails if someone changes the hardcoded values
    const rates = DEFAULT_PERIODS.map((p) => p.rate)
    expect(rates).toEqual([88, 98, 108])
  })
})
