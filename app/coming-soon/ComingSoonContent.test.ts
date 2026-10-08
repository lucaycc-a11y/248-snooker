import { describe, it, expect } from 'vitest'
import { getRemaining } from './ComingSoonContent'

describe('getRemaining', () => {
  it('calculates correct d/h/m/s for sample times', () => {
    const target = new Date('2026-10-13T10:00:00+08:00').getTime()
    const now = new Date('2026-10-10T10:00:00+08:00').getTime()

    const result = getRemaining(now, target)

    expect(result.days).toBe(3)
    expect(result.hours).toBe(0)
    expect(result.minutes).toBe(0)
    expect(result.seconds).toBe(0)
    expect(result.total).toBe(3 * 24 * 60 * 60 * 1000)
  })

  it('handles exactly zero remaining time', () => {
    const target = new Date('2026-10-13T10:00:00+08:00').getTime()
    const now = target

    const result = getRemaining(now, target)

    expect(result.days).toBe(0)
    expect(result.hours).toBe(0)
    expect(result.minutes).toBe(0)
    expect(result.seconds).toBe(0)
    expect(result.total).toBe(0)
  })

  it('clamps negative times to zero', () => {
    const target = new Date('2026-10-13T10:00:00+08:00').getTime()
    const now = new Date('2026-10-14T10:00:00+08:00').getTime()

    const result = getRemaining(now, target)

    expect(result.days).toBe(0)
    expect(result.hours).toBe(0)
    expect(result.minutes).toBe(0)
    expect(result.seconds).toBe(0)
    expect(result.total).toBe(0)
  })

  it('calculates mixed d/h/m/s correctly', () => {
    const target = new Date('2026-10-13T10:00:00+08:00').getTime()
    const now = new Date('2026-10-11T08:30:45+08:00').getTime()

    const result = getRemaining(now, target)

    expect(result.days).toBe(2)
    expect(result.hours).toBe(1)
    expect(result.minutes).toBe(29)
    expect(result.seconds).toBe(15)
  })

  it('handles less than one day remaining', () => {
    const target = new Date('2026-10-13T10:00:00+08:00').getTime()
    const now = new Date('2026-10-13T06:15:30+08:00').getTime()

    const result = getRemaining(now, target)

    expect(result.days).toBe(0)
    expect(result.hours).toBe(3)
    expect(result.minutes).toBe(44)
    expect(result.seconds).toBe(30)
  })

  it('handles less than one hour remaining', () => {
    const target = new Date('2026-10-13T10:00:00+08:00').getTime()
    const now = new Date('2026-10-13T09:45:10+08:00').getTime()

    const result = getRemaining(now, target)

    expect(result.days).toBe(0)
    expect(result.hours).toBe(0)
    expect(result.minutes).toBe(14)
    expect(result.seconds).toBe(50)
  })

  it('handles less than one minute remaining', () => {
    const target = new Date('2026-10-13T10:00:00+08:00').getTime()
    const now = new Date('2026-10-13T09:59:30+08:00').getTime()

    const result = getRemaining(now, target)

    expect(result.days).toBe(0)
    expect(result.hours).toBe(0)
    expect(result.minutes).toBe(0)
    expect(result.seconds).toBe(30)
  })
})
