import { describe, it, expect } from 'vitest'
import { calculatePrice, quoteBlockTotal } from './pricing'
import { DEFAULT_PERIODS, type PricingPeriod } from './data/pricing'

describe('calculatePrice', () => {
  it('11:00-13:00 = 186 (1h morning 88 + 1h afternoon 98)', () => {
    const slotStart = new Date('2026-01-15T11:00:00') // Thursday
    const slotEnd = new Date('2026-01-15T13:00:00')
    const quote = calculatePrice(slotStart, slotEnd, { discount: 1, multiplier: 1 }, DEFAULT_PERIODS)
    expect(quote.total).toBe(186)
  })

  it('17:00-19:00 = 206 (1h afternoon 98 + 1h evening 108)', () => {
    const slotStart = new Date('2026-01-15T17:00:00')
    const slotEnd = new Date('2026-01-15T19:00:00')
    const quote = calculatePrice(slotStart, slotEnd, { discount: 1, multiplier: 1 }, DEFAULT_PERIODS)
    expect(quote.total).toBe(206)
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

  it('DEFAULT_PERIODS has correct rates and ranges', () => {
    expect(DEFAULT_PERIODS).toEqual([
      { id: 'morning', rate: 88, start: '06:00', end: '12:00', days: 'all' },
      { id: 'afternoon', rate: 98, start: '12:00', end: '18:00', days: 'all' },
      { id: 'evening', rate: 108, start: '18:00', end: '24:00', days: 'all' },
    ])

    // Verify rates are 88/98/108 and ranges are correct
    expect(DEFAULT_PERIODS[0].rate).toBe(88)
    expect(DEFAULT_PERIODS[0].start).toBe('06:00')
    expect(DEFAULT_PERIODS[0].end).toBe('12:00')

    expect(DEFAULT_PERIODS[1].rate).toBe(98)
    expect(DEFAULT_PERIODS[1].start).toBe('12:00')
    expect(DEFAULT_PERIODS[1].end).toBe('18:00')

    expect(DEFAULT_PERIODS[2].rate).toBe(108)
    expect(DEFAULT_PERIODS[2].start).toBe('18:00')
    expect(DEFAULT_PERIODS[2].end).toBe('24:00')
  })
})


describe('calculatePrice — 連訂 (pricing v2)', () => {
  const tier = { discount: 1, multiplier: 1 }
  const v2: PricingPeriod[] = DEFAULT_PERIODS.map((p) => ({
    ...p,
    comboRate: { morning: 75, afternoon: 85, evening: 95 }[p.id as 'morning' | 'afternoon' | 'evening'],
    comboMinHours: 2,
  }))
  const q = (a: string, b: string, periods = v2) =>
    calculatePrice(new Date(`2026-01-15T${a}:00`), new Date(`2026-01-15T${b}:00`), tier, periods).total

  it('1h stays at the normal rate (no 連訂)', () => {
    expect(q('09:00', '10:00')).toBe(88)
    expect(q('14:00', '15:00')).toBe(98)
    expect(q('20:00', '21:00')).toBe(108)
  })
  it('2h+ in one period uses the 連訂 rate', () => {
    expect(q('09:00', '11:00')).toBe(150)
    expect(q('14:00', '16:00')).toBe(170)
    expect(q('19:00', '21:00')).toBe(190)
  })
  it('16:00–20:00 = 下午連訂 x2 + 黃金連訂 x2 = 360 (Luca example)', () => {
    expect(q('16:00', '20:00')).toBe(360)
  })
  it('1h afternoon + 1h evening (17–19) is a 2h block → both at 連訂', () => {
    expect(q('17:00', '19:00')).toBe(85 + 95)
  })
  it('without comboRate (pre-go-live, non-admin) prices are unchanged', () => {
    expect(q('16:00', '20:00', DEFAULT_PERIODS)).toBe(98 * 2 + 108 * 2)
  })
})
