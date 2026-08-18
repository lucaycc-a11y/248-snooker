import { expect, it } from 'vitest'
import { isSlotStillBookable, slotStartInHongKong } from './slot-cutoff'

const slot = slotStartInHongKong('2026-08-18', 3)

it('allows a booking five minutes after the slot starts', () => {
  expect(isSlotStillBookable(slot, new Date('2026-08-17T19:05:00.000Z'))).toBe(true)
})

it('rejects a booking at the fifteen-minute cutoff', () => {
  expect(isSlotStillBookable(slot, new Date('2026-08-17T19:15:00.000Z'))).toBe(false)
})

it('rejects a booking after the fifteen-minute cutoff', () => {
  expect(isSlotStillBookable(slot, new Date('2026-08-17T19:20:00.000Z'))).toBe(false)
})

it('keeps a future slot bookable', () => {
  expect(isSlotStillBookable(slotStartInHongKong('2026-08-18', 4), new Date('2026-08-17T19:20:00.000Z'))).toBe(true)
})

it.each([1, 2])('uses the same cutoff for table %s', () => {
  expect(isSlotStillBookable(slot, new Date('2026-08-17T19:05:00.000Z'))).toBe(true)
  expect(isSlotStillBookable(slot, new Date('2026-08-17T19:20:00.000Z'))).toBe(false)
})
