import { describe, it, expect } from 'vitest'
import { calculatePrice, quoteBlockTotal } from './pricing'
import { DEFAULT_PERIODS } from './data/pricing'

describe('calculatePrice', () => {
  it('11:00-13:00 = 186 (1h morning 88 + 1h afternoon 98)', () => {
    const slotStart = new Date('2026-01-15T11:00:00') // Thursday
    const slotEnd = new Date('2026-01-15T13:00:00')
    const quote = calculatePrice(slotStart, slotEnd, { discount: 1, multiplier: 1 }, DEFAULT_PERIODS)
    expect(quote.total).toBe(186)
  })

  it('17:00-19:00 = 216 (both hours evening 108)', () => {
    const slotStart = new Date('2026-01-15T17:00:00')
    const slotEnd = new Date('2026-01-15T19:00:00')
    const quote = calculatePrice(slotStart, slotEnd, { discount: 1, multiplier: 1 }, DEFAULT_PERIODS)
    expect(quote.total).toBe(216)
  })

  it('06:00-12:00 = 528 (6 hours morning 88/h)', () => {
    const slotStart = new Date('2026-01-15T06:00:00')
    const slotEnd = new Date('2026-01-15T12:00:00')
    const quote = calculatePrice(slotStart, slotEnd, { discount: 1, multiplier: 1 }, DEFAULT_PERIODS)
    expect(quote.total).toBe(528)
  })

  it('23:00-24:00 = 108 (1 hour evening 108)', () => {
    const slotStart = new Date('2026-01-15T23:00:00')
    const slotEnd = new Date('2026-01-16T00:00:00')
    const quote = calculatePrice(slotStart, slotEnd, { discount: 1, multiplier: 1 }, DEFAULT_PERIODS)
    expect(quote.total).toBe(108)
  })

  it('no multi-hour discount: 2 hours same period bills at full rate', () => {
    const slotStart = new Date('2026-01-15T06:00:00') // morning period
    const slotEnd = new Date('2026-01-15T08:00:00')
    const quote = calculatePrice(slotStart, slotEnd, { discount: 1, multiplier: 1 }, DEFAULT_PERIODS)
    expect(quote.total).toBe(176) // 88 + 88, no discount
  })
})
