import { describe, it, expect } from 'vitest'
import { splitMemberBookings } from './member-booking-split'

const b = (date: string, startTime: string, durationHours = 1, status = 'confirmed') => ({
  date,
  startTime,
  durationHours,
  status,
})

describe('splitMemberBookings', () => {
  // 2026-10-09 14:00 HKT
  const now = new Date('2026-10-09T06:00:00Z')

  it('keeps a future booking (just paid) in upcoming', () => {
    const { upcoming, past } = splitMemberBookings([b('2026-10-20', '19:00')], now)
    expect(upcoming).toHaveLength(1)
    expect(past).toHaveLength(0)
  })

  it('keeps a same-day booking that has not ended in upcoming (no UTC-midnight bug)', () => {
    const { upcoming } = splitMemberBookings([b('2026-10-09', '13:30', 1)], now)
    expect(upcoming).toHaveLength(1)
  })

  it('moves a booking to past once its slot has ended', () => {
    const { past } = splitMemberBookings([b('2026-10-09', '12:00', 2)], now)
    expect(past).toHaveLength(1)
  })

  it('handles DB formats: HH:MM:SS, H:MM and numeric-string durations', () => {
    const { upcoming, past } = splitMemberBookings(
      [
        { date: '2026-10-09', startTime: '13:30:00', durationHours: '1' as unknown as number, status: 'confirmed' },
        { date: '2026-10-09', startTime: '9:00', durationHours: 2, status: 'confirmed' },
      ],
      now,
    )
    expect(upcoming.map((x) => x.startTime)).toEqual(['13:30:00'])
    expect(past.map((x) => x.startTime)).toEqual(['9:00'])
  })

  it('treats completed as past and orders each group', () => {
    const { upcoming, past } = splitMemberBookings(
      [b('2026-10-30', '10:00'), b('2026-10-12', '10:00'), b('2026-09-01', '10:00'), b('2026-10-01', '10:00'), b('2026-12-01', '10:00', 1, 'completed')],
      now,
    )
    expect(upcoming.map((x) => x.date)).toEqual(['2026-10-12', '2026-10-30'])
    expect(past.map((x) => x.date)).toEqual(['2026-12-01', '2026-10-01', '2026-09-01'])
  })
})
