// UAT test-price override — applies ONLY to bookings flagged is_test = true.
//
// WHY THIS EXISTS
// uat.space8.com.hk shares the PRODUCTION KPay merchant account (there is no
// KPay sandbox). A test booking therefore moves REAL money. Rather than fake the
// payment — which would leave the most failure-prone part of the system
// untested — we charge a real but trivial amount, e.g. HK$1.
//
// HARD INVARIANTS
//  1. Nothing here runs unless is_test === true. For a normal booking every
//     exported function is a no-op that returns the input total unchanged.
//  2. config.pricing / config.pricing_rates are never read or written here. The
//     normal path (loadPeriods -> calculatePrice) is untouched.
//  3. No active row => fall back to the real calculated price and warn LOUDLY.
//     Never silently charge 0, never fail the booking.

import type { getServiceSupabase } from '@/lib/supabase/service'

type ServiceClient = ReturnType<typeof getServiceSupabase>

export type UatTestPrice = {
  id: string
  mode: 'flat' | 'per_hour'
  amount: number
  label: string | null
  updatedAt: string
}

export type OverrideOutcome =
  | { applied: false; reason: 'not_test_booking' | 'no_active_row' | 'lookup_failed'; total: number }
  | { applied: true; total: number; originalTotal: number; price: UatTestPrice }

function isTestPriceRow(value: unknown): value is {
  id: string
  mode: 'flat' | 'per_hour'
  amount: number | string
  label: string | null
  updated_at: string
} {
  if (typeof value !== 'object' || value === null) return false
  const r = value as Record<string, unknown>
  const amountOk = typeof r.amount === 'number' || typeof r.amount === 'string'
  return (
    typeof r.id === 'string' &&
    (r.mode === 'flat' || r.mode === 'per_hour') &&
    amountOk &&
    (typeof r.label === 'string' || r.label === null) &&
    typeof r.updated_at === 'string'
  )
}

/**
 * DEPRECATED: uat_test_pricing table was archived on 2026-10-02.
 * This function now always returns null, causing test bookings to use real pricing_rates.
 *
 * Historical context: Previously read the single active override row. Returns null when none is
 * configured or the row is malformed — callers treat null as "use the real price".
 */
export async function getActiveTestPrice(service: ServiceClient): Promise<UatTestPrice | null> {
  // Table is archived; fall back to real pricing instead of trying to query it
  console.warn('[uat/test-pricing] uat_test_pricing table was archived; using real pricing_rates instead')
  return null
}

/** flat => the whole booking costs `amount`. per_hour => `amount` * hours. */
export function computeOverrideTotal(price: UatTestPrice, durationHours: number): number {
  if (price.mode === 'flat') return price.amount
  const hours = Number.isFinite(durationHours) && durationHours > 0 ? durationHours : 1
  return price.amount * hours
}

/**
 * The override entry point. `isTest` MUST be the resolved test-booking flag; when
 * it is false this returns the original total without touching the database, so a
 * production booking cannot read uat_test_pricing even by accident.
 *
 * KPay rejects zero-amount orders, so a configured override of 0 is floored to
 * the smallest chargeable amount (HK$1) rather than producing an order that
 * cannot be created.
 */
export async function applyTestPriceOverride(args: {
  service: ServiceClient
  isTest: boolean
  total: number
  durationHours: number
  bookingId: string
}): Promise<OverrideOutcome> {
  const { service, isTest, total, durationHours, bookingId } = args

  if (!isTest) return { applied: false, reason: 'not_test_booking', total }

  const price = await getActiveTestPrice(service)
  if (!price) {
    // Deliberately loud: a test booking is about to charge the REAL price to a
    // real merchant account. That is the safe direction to fail, but the
    // operator must know it happened.
    console.warn('[uat/test-pricing] no_active_override_charging_real_price', {
      bookingId,
      realTotal: total,
      hint: 'Set an active row via dev2 > Quick Actions > Set UAT Test Price',
    })
    return { applied: false, reason: 'no_active_row', total }
  }

  const raw = computeOverrideTotal(price, durationHours)
  const overridden = Math.max(1, Math.round(raw * 100) / 100)

  console.log('[uat/test-pricing] override_applied', {
    bookingId,
    originalTotal: total,
    overriddenTotal: overridden,
    mode: price.mode,
    amount: price.amount,
    durationHours,
  })

  return { applied: true, total: overridden, originalTotal: total, price }
}
