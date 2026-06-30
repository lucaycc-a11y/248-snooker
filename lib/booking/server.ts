import { getPublicSupabase } from '@/lib/supabase/public'
import { getServiceSupabase } from '@/lib/supabase/service'
import {
  DEFAULT_PERIODS,
  DEFAULT_TIERS,
  resolveTier,
  type PricingPeriod,
  type Tier,
} from '@/lib/data/pricing'

// Shared server-side helpers for the booking/payment routes. Reconciled against
// the real schema (verified via Supabase): locking lives ON the `slots` row
// (status/locked_by/locked_until) — there is no slot_locks table.

const TABLE_NUMBERS = [1, 2] as const

/** Load live pricing periods from the `config` table; fall back to bundled defaults. */
export async function loadPeriods(): Promise<PricingPeriod[]> {
  const supabase = getPublicSupabase()
  if (!supabase) return DEFAULT_PERIODS
  const { data, error } = await supabase
    .from('config')
    .select('value')
    .eq('key', 'pricing')
    .single()
  const periods = (data?.value as { periods?: PricingPeriod[] } | null)?.periods
  if (error || !periods?.length) return DEFAULT_PERIODS
  return periods
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
}

/**
 * Raw booked/active-locked slot rows for a date AND its neighbours (prev/next
 * day), so cross-midnight bookings are accounted for when the client computes
 * availability. Fails to an empty list on error (the client then treats the day
 * as fully open; the lock RPC remains the authoritative guard).
 */
export async function getDaySlots(date: string): Promise<DaySlotRow[]> {
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
    .select('table_number, date, start_time, duration_hours, status, locked_until')
    .in('date', [fmt(prev), date, fmt(next)])
    .in('status', ['locked', 'booked'])
  if (error) {
    console.error('day_slots_query_error', error.message)
    return []
  }
  return (data ?? []) as DaySlotRow[]
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
