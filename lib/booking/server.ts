import { getPublicSupabase } from '@/lib/supabase/public'
import { getServiceSupabase } from '@/lib/supabase/service'
import {
  DEFAULT_PERIODS,
  DEFAULT_TIERS,
  pricingRatesToPeriods,
  resolveTier,
  type PricingPeriod,
  type PricingRates,
  type Tier,
} from '@/lib/data/pricing'

// Shared server-side helpers for the booking/payment routes. Reconciled against
// the real schema (verified via Supabase): locking lives ON the `slots` row
// (status/locked_by/locked_until) — there is no slot_locks table.

const TABLE_NUMBERS = [1, 2] as const

/** Load live pricing periods from the `config` table (`pricing_rates` key); fall back to bundled defaults. */
export async function loadPeriods(): Promise<PricingPeriod[]> {
  const supabase = getPublicSupabase()
  if (!supabase) return DEFAULT_PERIODS
  const { data, error } = await supabase
    .from('config')
    .select('value')
    .eq('key', 'pricing_rates')
    .single()
  const rates = data?.value as PricingRates | null
  if (error || !rates || typeof rates !== 'object' || Array.isArray(rates)) return DEFAULT_PERIODS
  return pricingRatesToPeriods(rates)
}

/** Resolve a member's tier from their points balance. Guests → Amateur (base tier). */
export async function resolveTierForUser(userId?: string | null): Promise<Tier> {
  if (!userId) return DEFAULT_TIERS[0]
  const supabase = getServiceSupabase()
  // users.points is the running balance (verified). The update_tier_trigger keeps
  // users.tier in sync, but we resolve from points here so pricing stays a pure
  // function of the ledger.
  const { data } = await supabase
    .from('users')
    .select('points')
    .eq('id', userId)
    .single()
  const points = typeof data?.points === 'number' ? data.points : 0
  return resolveTier(points, DEFAULT_TIERS).current
}

/** Build local-time slot bounds from a date + whole-hour start + duration. */
export function slotBounds(date: string, startHour: number, durationHours: number) {
  const slotStart = new Date(`${date}T00:00:00`)
  slotStart.setHours(startHour, 0, 0, 0)
  const slotEnd = new Date(slotStart)
  slotEnd.setHours(slotEnd.getHours() + durationHours)
  return { slotStart, slotEnd }
}

/** The booking's `period` column value — the period covering its START hour. */
export function periodForStart(
  startHour: number,
  weekend: boolean,
  periods: PricingPeriod[],
): string {
  const minute = startHour * 60
  for (const p of periods) {
    const applies =
      p.days === 'all' || (weekend ? p.days === 'weekend' : p.days === 'weekday')
    if (!applies) continue
    const [sh, sm] = p.start.split(':').map(Number)
    const [eh, em] = p.end.split(':').map(Number)
    const start = sh * 60 + sm
    const end = eh * 60 + em === 0 ? 24 * 60 : eh * 60 + em
    if (minute >= start && minute < end) return p.id
  }
  return 'afternoon' // safe fallback for the uncovered morning gap
}

/**
 * Which tables (1, 2) are free for a date + start hour + duration. ADVISORY ONLY
 * for the UI — the authoritative guard is find_or_lock_slot()'s atomic check. A
 * table is taken if a BOOKED row, or an ACTIVE (unexpired) lock, overlaps the
 * requested window. Overlap is computed from real timestamps so cross-midnight
 * bookings are handled. Fails OPEN (returns both tables) on error, since the
 * lock RPC will still reject a real conflict.
 */
export async function getAvailableTables(
  date: string,
  startHour: number,
  durationHours: number,
): Promise<number[]> {
  const { slotStart: reqStart, slotEnd: reqEnd } = slotBounds(date, startHour, durationHours)
  const supabase = getServiceSupabase()
  const { data, error } = await supabase
    .from('slots')
    .select('table_number, date, start_time, duration_hours, status, locked_until')
    .eq('date', date)
    .in('status', ['locked', 'booked'])
  if (error) {
    console.error('availability_query_error', error.message)
    return [...TABLE_NUMBERS] // fail open — RPC is the real guard
  }

  const taken = new Set<number>()
  for (const s of data ?? []) {
    // Expired locks don't count as taken.
    if (s.status === 'locked' && (!s.locked_until || new Date(s.locked_until) <= new Date())) {
      continue
    }
    const eStart = new Date(`${s.date}T${s.start_time}`)
    const eEnd = new Date(eStart)
    eEnd.setHours(eEnd.getHours() + Number(s.duration_hours))
    if (eStart < reqEnd && reqStart < eEnd) taken.add(s.table_number)
  }
  return TABLE_NUMBERS.filter((t) => !taken.has(t))
}

export type DaySlotRow = {
  table_number: number
  date: string
  start_time: string
  duration_hours: number
  status: string
  locked_until: string | null
  // true when the CALLING user (not any other user) holds this lock — never
  // the raw locked_by uuid, which would leak other users' identities to the
  // client. Always false for a guest (userId === null) or a booked row.
  locked_by_you: boolean
}

// Strips locked_by off a raw slots row and replaces it with the boolean
// locked_by_you, computed against the calling user. Shared by getDaySlots/
// getRangeSlots so the "never leak locked_by" rule lives in one place.
function toDaySlotRow(
  row: { table_number: number; date: string; start_time: string; duration_hours: number; status: string; locked_until: string | null; locked_by: string | null },
  userId: string | null,
): DaySlotRow {
  return {
    table_number: row.table_number,
    date: row.date,
    start_time: row.start_time,
    duration_hours: row.duration_hours,
    status: row.status,
    locked_until: row.locked_until,
    locked_by_you: userId !== null && row.locked_by === userId,
  }
}

/**
 * Raw booked/active-locked slot rows for a date AND its neighbours (prev/next
 * day), so cross-midnight bookings are accounted for when the client computes
 * availability. Fails to an empty list on error (the client then treats the day
 * as fully open; the lock RPC remains the authoritative guard).
 *
 * userId (null for guests) is used ONLY to compute locked_by_you server-side —
 * the raw locked_by column is never returned to the client.
 */
export async function getDaySlots(date: string, userId: string | null = null): Promise<DaySlotRow[]> {
  const base = new Date(`${date}T00:00:00`)
  if (Number.isNaN(base.getTime())) return []
  const fmt = (x: Date) =>
    `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
  const prev = new Date(base)
  prev.setDate(prev.getDate() - 1)
  const next = new Date(base)
  next.setDate(next.getDate() + 1)

  const supabase = getServiceSupabase()
  const { data, error } = await supabase
    .from('slots')
    .select('table_number, date, start_time, duration_hours, status, locked_until, locked_by')
    .in('date', [fmt(prev), date, fmt(next)])
    .in('status', ['locked', 'booked'])
  if (error) {
    console.error('day_slots_query_error', error.message)
    return []
  }
  return (data ?? []).map((row) => toDaySlotRow(row, userId))
}

/**
 * Raw booked/active-locked slot rows spanning [startDate, startDate + days),
 * padded by one day on each side so cross-midnight bookings at the range edges
 * are accounted for. Powers the client's day-switch prefetch cache (Task 1): one
 * query covers a week so switching dates needs no further network round-trip.
 * Same fail-open contract as getDaySlots.
 */
export async function getRangeSlots(
  startDate: string,
  days: number,
  userId: string | null = null,
): Promise<DaySlotRow[]> {
  const base = new Date(`${startDate}T00:00:00`)
  if (Number.isNaN(base.getTime()) || days < 1) return []
  const fmt = (x: Date) =>
    `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
  const from = new Date(base)
  from.setDate(from.getDate() - 1) // pad for cross-midnight at the low edge
  const to = new Date(base)
  to.setDate(to.getDate() + days) // exclusive end already pads the high edge

  const supabase = getServiceSupabase()
  const { data, error } = await supabase
    .from('slots')
    .select('table_number, date, start_time, duration_hours, status, locked_until, locked_by')
    .gte('date', fmt(from))
    .lte('date', fmt(to))
    .in('status', ['locked', 'booked'])
  if (error) {
    console.error('range_slots_query_error', error.message)
    return []
  }
  return (data ?? []).map((row) => toDaySlotRow(row, userId))
}

export type LockedSlot = {
  id: string
  date: string
  start_time: string
  end_time: string
  duration_hours: number
  table_number: number
  price: number
}

/**
 * Validate that a slot is locked by this user and the hold hasn't expired.
 * Returns the slot row (for server-side price re-derivation) or null.
 */
export async function validateSlotLock(
  slotId: string,
  userId: string,
): Promise<LockedSlot | null> {
  const supabase = getServiceSupabase()
  const { data: s, error } = await supabase
    .from('slots')
    .select('id, date, start_time, end_time, duration_hours, table_number, price, status, locked_by, locked_until')
    .eq('id', slotId)
    .single()
  if (error || !s) return null
  if (s.status !== 'locked') return null
  if (s.locked_by !== userId) return null
  if (!s.locked_until || new Date(s.locked_until) <= new Date()) return null
  return {
    id: s.id,
    date: s.date,
    start_time: s.start_time,
    end_time: s.end_time,
    duration_hours: Number(s.duration_hours),
    table_number: s.table_number,
    price: s.price,
  }
}
