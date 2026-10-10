// Splits a member's bookings into upcoming vs past for the /member views.
// A booking is "past" once its slot has ENDED (Hong Kong time), not at
// midnight UTC of its date — `new Date('2026-10-09')` is 08:00 HKT, which
// used to move a same-day booking into history before it had even started.

export type SplittableBooking = {
  date: string | null
  startTime: string | null
  durationHours: number
  status: string
}

const HKT_OFFSET = '+08:00'

export function bookingEndMs(b: SplittableBooking): number | null {
  if (!b.date) return null
  // DB `time` comes back as HH:MM:SS; tolerate H:MM too
  const m = /^(\d{1,2}):(\d{2})/.exec(b.startTime ?? '00:00')
  const time = m ? `${m[1].padStart(2, '0')}:${m[2]}` : '00:00'
  const start = Date.parse(`${b.date.slice(0, 10)}T${time}:00${HKT_OFFSET}`)
  if (Number.isNaN(start)) return null
  return start + (Number(b.durationHours) || 0) * 3_600_000
}

export function splitMemberBookings<T extends SplittableBooking>(
  all: T[],
  now: Date = new Date(),
): { upcoming: T[]; past: T[] } {
  const upcoming: T[] = []
  const past: T[] = []
  for (const b of all) {
    const end = bookingEndMs(b)
    if (b.status === 'completed' || (end !== null && end <= now.getTime())) past.push(b)
    else if (end !== null) upcoming.push(b)
  }
  upcoming.sort((a, b) => (bookingEndMs(a) ?? 0) - (bookingEndMs(b) ?? 0)) // soonest first
  past.sort((a, b) => (bookingEndMs(b) ?? 0) - (bookingEndMs(a) ?? 0)) // newest first
  return { upcoming, past }
}
