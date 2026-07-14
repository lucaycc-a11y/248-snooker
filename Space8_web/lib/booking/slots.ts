// Shared pure types/logic for the /book flow's slot selection — used by
// app/[locale]/book/page.tsx (state/orchestration) and the presentational
// components under components/booking/. Moved out of page.tsx unchanged so
// the dual-table redesign's new components can share the exact same
// availability/grouping logic instead of re-deriving it.

// Venue time is Hong Kong (UTC+8) regardless of the user's device timezone.
// Deriving "today" and "current hour" from the browser's local clock caused a
// P0 bug where a device in another timezone (or a memoized snapshot) greyed
// out valid slots. Read the parts through Intl in the fixed venue zone instead.
const HK_TIME_ZONE = "Asia/Hong_Kong"

export function getHongKongNow(date = new Date()): { date: string; hour: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: HK_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(date)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ""
  // Intl can emit "24" for midnight in some engines; normalise to 0.
  const rawHour = Number(get("hour"))
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    hour: rawHour % 24,
  }
}

export type DaySlot = {
  table_number: number
  date: string
  start_time: string
  duration_hours: number
  status: string
  locked_until: string | null
  locked_by_you: boolean
}

export const ALL_TABLES = [1, 2]

// One selected slot block (a contiguous run of hours on one date, one table).
// The order is the union of every run across every date the user has picked
// hours on (selectedHoursByDate), grouped via groupHoursIntoRuns().
export type SelectedBlock = {
  date: string // 'YYYY-MM-DD'
  startHour: number
  duration: number
  tableNumber: number
}

// Collapse a set of selected hours (one date) into contiguous runs. Pure —
// sorts ascending, merges adjacent hours into a single run each.
export function groupHoursIntoRuns(
  hours: Iterable<number>,
  date: string,
  tableNumber: number,
): SelectedBlock[] {
  const sorted = Array.from(hours).sort((a, b) => a - b)
  const runs: SelectedBlock[] = []
  for (const h of sorted) {
    const last = runs[runs.length - 1]
    if (last && last.startHour + last.duration === h) {
      last.duration += 1
    } else {
      runs.push({ date, startHour: h, duration: 1, tableNumber })
    }
  }
  return runs
}

// Time-slot grid is grouped into labelled periods. Venue hours: 06:00–24:00
// (last bookable slot starts at 23:00). Hours are inclusive-start. Ids match
// lib/data/pricing.ts's PricingPeriod['id'] ('morning' | 'afternoon' |
// 'evening') 1:1 — both the UI grouping and the billing periods split at
// 06/12/16 for the same reason (venue's real rate card).
export const SLOT_GROUPS: { key: "morning" | "afternoon" | "evening"; hours: number[] }[] = [
  { key: "morning", hours: [6, 7, 8, 9, 10, 11] },
  { key: "afternoon", hours: [12, 13, 14, 15, 16, 17] },
  { key: "evening", hours: [18, 19, 20, 21, 22, 23] },
]

export type TableState = "available" | "locked_by_you" | "locked" | "booked"

// Per-table state for [startHour, startHour+duration) on `dateStr`, given the
// day's booked/active-locked slots. Pure + client-side so it drives both the
// grid greying and the table selection without extra API calls.
// "locked_by_you" = the caller's OWN active hold (e.g. an abandoned checkout) —
// clickable, resumes straight to payment (see onResumeLocked). "locked" =
// someone else's active 15-min hold; "booked" = confirmed.
export function tableStatesFor(
  daySlots: DaySlot[],
  dateStr: string,
  startHour: number,
  duration: number,
): Map<number, TableState> {
  const reqStart = new Date(`${dateStr}T00:00:00`)
  reqStart.setHours(startHour, 0, 0, 0)
  const reqEnd = new Date(reqStart)
  reqEnd.setHours(reqEnd.getHours() + duration)
  const now = new Date()
  const states = new Map<number, TableState>(ALL_TABLES.map((tn) => [tn, "available"]))
  for (const s of daySlots) {
    // Expired locks don't count as taken.
    if (s.status === "locked" && (!s.locked_until || new Date(s.locked_until) <= now)) {
      continue
    }
    const eStart = new Date(`${s.date}T${s.start_time}`)
    const eEnd = new Date(eStart)
    eEnd.setHours(eEnd.getHours() + Number(s.duration_hours))
    if (eStart < reqEnd && reqStart < eEnd) {
      states.set(
        s.table_number,
        s.status === "booked" ? "booked" : s.locked_by_you ? "locked_by_you" : "locked",
      )
    }
  }
  return states
}

// Worst (most-restrictive) per-table state across an arbitrary set of (date,
// hour) pairs spanning the WHOLE order, not just one date — a single global
// selectedTable must be valid for every block. Fails open per-date (a date
// whose daySlots haven't loaded yet contributes no restriction; the caller's
// fetch effect populates it and this recomputes once cached).
export function tableStatesForOrder(
  selectedHoursByDate: Map<string, Set<number>>,
  getDaySlots: (date: string) => DaySlot[] | null,
): Map<number, TableState> {
  const worst = new Map<number, TableState>(ALL_TABLES.map((tn) => [tn, "available"]))
  const rank = { available: 0, locked_by_you: 1, locked: 2, booked: 3 } as const
  for (const [date, hours] of selectedHoursByDate) {
    const daySlots = getDaySlots(date)
    if (!daySlots) continue
    for (const h of hours) {
      const states = tableStatesFor(daySlots, date, h, 1)
      for (const tn of ALL_TABLES) {
        const s = states.get(tn) ?? "available"
        if (rank[s] > rank[worst.get(tn)!]) worst.set(tn, s)
      }
    }
  }
  return worst
}

// Shared parser for the persisted-selection JSON shape (both the durable
// bookingSelection key and the one-shot pendingBooking key use this).
export function parseSelectionEntries(entries: unknown): Map<string, Set<number>> {
  const restored = new Map<string, Set<number>>()
  if (!Array.isArray(entries)) return restored
  for (const e of entries) {
    if (typeof (e as { date?: unknown })?.date !== "string") continue
    const { date, hours } = e as { date: string; hours: unknown }
    const validHours = Array.isArray(hours) ? hours.filter((h): h is number => typeof h === "number") : []
    if (validHours.length > 0) restored.set(date, new Set(validHours))
  }
  return restored
}
