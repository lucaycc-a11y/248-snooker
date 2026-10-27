// Member figures shown at the top of 會員 and answered by the AI's member tools.
// One definition, so the page and the AI can never disagree:
//   • 本週新增     — joined in the last 7 days
//   • 有預約       — at least 1 confirmed, non-test booking
//   • 從未預約     — joined but no confirmed booking yet
//   • 回頭客       — 2 or more confirmed bookings
// Pure functions only (no I/O) so they are safe to import from client components.

export type MemberFigureInput = {
  createdAt: string | null
  bookingCount: number
  totalSpend: number
  isBlacklisted: boolean
  needsManualPhoneReverify: boolean
}

export type MemberStats = {
  total: number
  newLast7Days: number
  newLast30Days: number
  booked: number
  neverBooked: number
  repeat: number
  /** booked / total, whole percent. */
  bookedPercent: number
  blacklisted: number
  needsReverify: number
  totalSpend: number
  /** Average spend per member who has booked, rounded. */
  avgSpendPerBooked: number
}

const DAY_MS = 86_400_000

export function daysSince(iso: string | null, now = Date.now()): number | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  return Number.isNaN(t) ? null : Math.max(0, Math.floor((now - t) / DAY_MS))
}

export function memberStats(rows: MemberFigureInput[], now = Date.now()): MemberStats {
  let new7 = 0
  let new30 = 0
  let booked = 0
  let repeat = 0
  let blacklisted = 0
  let reverify = 0
  let spend = 0
  for (const r of rows) {
    const age = daysSince(r.createdAt, now)
    if (age !== null && age < 7) new7 += 1
    if (age !== null && age < 30) new30 += 1
    if (r.bookingCount >= 1) booked += 1
    if (r.bookingCount >= 2) repeat += 1
    if (r.isBlacklisted) blacklisted += 1
    if (r.needsManualPhoneReverify) reverify += 1
    spend += r.totalSpend
  }
  const total = rows.length
  return {
    total,
    newLast7Days: new7,
    newLast30Days: new30,
    booked,
    neverBooked: total - booked,
    repeat,
    bookedPercent: total === 0 ? 0 : Math.round((booked / total) * 100),
    blacklisted,
    needsReverify: reverify,
    totalSpend: spend,
    avgSpendPerBooked: booked === 0 ? 0 : Math.round(spend / booked),
  }
}
