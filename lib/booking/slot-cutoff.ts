const HONG_KONG_OFFSET_MINUTES = 8 * 60
export const SLOT_BOOKING_CUTOFF_MINUTES = 15

function isValidCalendarDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false
  const [year, month, day] = date.split("-").map(Number)
  const candidate = new Date(Date.UTC(year, month - 1, day))
  return candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() === month - 1 &&
    candidate.getUTCDate() === day
}

/** Return whether a date/hour is a valid Hong Kong booking slot start. */
export function isValidSlotStart(date: string, startHour: number): boolean {
  return isValidCalendarDate(date) && Number.isInteger(startHour) && startHour >= 0 && startHour <= 23
}

/**
 * Convert a venue-local booking date/hour into an absolute instant.
 * The explicit UTC+8 conversion keeps this independent of the runtime timezone.
 */
export function slotStartInHongKong(date: string, startHour: number): Date {
  if (!isValidSlotStart(date, startHour)) {
    throw new RangeError(`Invalid booking slot: ${date} ${startHour}`)
  }

  const [year, month, day] = date.split("-").map(Number)
  const timestamp = Date.UTC(year, month - 1, day, startHour) - HONG_KONG_OFFSET_MINUTES * 60 * 1000
  return new Date(timestamp)
}

/** Return whether a new booking may still start for this slot. */
export function isSlotStillBookable(
  slotStartTime: Date,
  now: Date = new Date(),
): boolean {
  if (Number.isNaN(slotStartTime.getTime()) || Number.isNaN(now.getTime())) return false
  const cutoff = slotStartTime.getTime() + SLOT_BOOKING_CUTOFF_MINUTES * 60 * 1000
  return now.getTime() < cutoff
}
