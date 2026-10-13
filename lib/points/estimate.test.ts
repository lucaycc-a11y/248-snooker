import { describe, it, expect } from 'vitest'
import { estimateEarnPoints, tierMultiplier } from './estimate'

describe('estimateEarnPoints', () => {
  it('HK$1 = 1 point on the amount paid (HK$88 − HK$52 wallet = HK$36)', () => {
    expect(estimateEarnPoints(36)).toBe(36)
    expect(estimateEarnPoints(36, 1)).toBe(36)
  })

  it('fully wallet/promo-covered booking earns 0', () => {
    expect(estimateEarnPoints(0)).toBe(0)
    expect(estimateEarnPoints(0, 2)).toBe(0)
  })

  it('applies tier multiplier', () => {
    expect(estimateEarnPoints(88, 1.5)).toBe(132)
    expect(estimateEarnPoints(88, 2)).toBe(176)
  })

  it('rounds like the server round()', () => {
    expect(estimateEarnPoints(33, 1.5)).toBe(50) // 49.5 → 50
    expect(estimateEarnPoints(31, 1.5)).toBe(47) // 46.5 → 47
  })

  it('never exceeds amount paid at the default tier, and ignores bad input', () => {
    for (const n of [1, 36, 88, 216]) expect(estimateEarnPoints(n)).toBeLessThanOrEqual(n)
    expect(estimateEarnPoints(-5)).toBe(0)
    expect(estimateEarnPoints(Number.NaN)).toBe(0)
  })
})

describe('tierMultiplier', () => {
  it('matches confirm_booking mapping', () => {
    expect(tierMultiplier('maximum')).toBe(2)
    expect(tierMultiplier('century')).toBe(1.5)
    expect(tierMultiplier('amateur')).toBe(1)
    expect(tierMultiplier(null)).toBe(1)
  })
})
