// Server-side price calculation — the ONLY source of truth for what a booking
// costs. The client may DISPLAY a quote (via /api/booking/quote), but the amount
// charged to Stripe is always re-derived here at PaymentIntent creation time.
// Never trust a price that arrived from the browser.
//
// Rates come from the `config` table ('pricing' key), with DEFAULT_PERIODS as the
// offline fallback (see lib/data/pricing.ts). Period is resolved per-hour so a
// booking spanning, e.g., 17:00–19:00 is billed partly at the afternoon rate and
// partly at the evening rate.

import {
  DEFAULT_PERIODS,
  DEFAULT_SERVICES,
  type PricingPeriod,
  type ServiceFees,
  type Tier,
} from './data/pricing'

export type PriceLineItem = {
  hourStart: string // 'HH:MM' of this billed hour
  periodId: PricingPeriod['id'] | 'default'
  rate: number // HK$ for this hour
}

export type PriceQuote = {
  currency: 'hkd'
  /** Integer HK dollars charged to the member (after any member discount). */
  total: number
  /** Total in the smallest currency unit (cents) — what Stripe expects. */
  amountInCents: number
  /** Pre-discount subtotal, before tier discount. */
  subtotal: number
  /** Loyalty points this booking earns (does NOT affect the charged amount). */
  pointsEarned: number
  durationHours: number
  breakdown: PriceLineItem[]
}

function isWeekend(d: Date): boolean {
  const day = d.getDay() // 0 Sun … 6 Sat
  return day === 0 || day === 6
}

/** Does this period apply on the given day type? */
function periodAppliesOnDay(period: PricingPeriod, weekend: boolean): boolean {
  if (period.days === 'all') return true
  return weekend ? period.days === 'weekend' : period.days === 'weekday'
}

/** 'HH:MM' → minutes since midnight. */
function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/** Find the period covering a given hour-of-day for a given day type. */
function periodForHour(
  hourOfDay: number,
  weekend: boolean,
  periods: PricingPeriod[],
): PricingPeriod | null {
  const minute = hourOfDay * 60
  for (const p of periods) {
    if (!periodAppliesOnDay(p, weekend)) continue
    const start = toMinutes(p.start)
    // 'end' of '24:00' means end-of-day; treat 00:00 end as 24:00.
    const endRaw = toMinutes(p.end)
    const end = endRaw === 0 ? 24 * 60 : endRaw
    if (minute >= start && minute < end) return p
  }
  return null
}

/**
 * Calculate the price of a booking from its start/end and the member's tier.
 *
 * @param slotStart inclusive start (local HK time)
 * @param slotEnd   exclusive end
 * @param tier      the member's resolved tier (drives discount + points)
 * @param periods   rate config (pass the live config; defaults to fallback)
 */
export function calculatePrice(
  slotStart: Date,
  slotEnd: Date,
  tier: Pick<Tier, 'discount' | 'multiplier'>,
  periods: PricingPeriod[] = DEFAULT_PERIODS,
): PriceQuote {
  if (slotEnd <= slotStart) {
    throw new Error('slotEnd must be after slotStart')
  }

  const ms = slotEnd.getTime() - slotStart.getTime()
  const durationHours = ms / (1000 * 60 * 60)
  if (!Number.isInteger(durationHours) || durationHours < 1 || durationHours > 6) {
    // Bookings are whole-hour, 1–6h (config.maxHours). Reject anything else
    // rather than silently rounding — a non-integer duration means a bad client.
    throw new Error(`Invalid booking duration: ${durationHours}h`)
  }

  const weekend = isWeekend(slotStart)
  const breakdown: PriceLineItem[] = []
  let subtotal = 0

  const cursor = new Date(slotStart)
  for (let i = 0; i < durationHours; i++) {
    const hourOfDay = cursor.getHours()
    const period = periodForHour(hourOfDay, weekend, periods)
    // Fall back to the cheapest configured rate if no period matches (e.g. the
    // 06:00–12:00 morning gap) so we never bill HK$0 by accident.
    const rate = period
      ? period.rate
      : Math.min(...periods.map((p) => p.rate))
    subtotal += rate
    breakdown.push({
      hourStart: `${String(hourOfDay).padStart(2, '0')}:00`,
      periodId: period?.id ?? 'default',
      rate,
    })
    cursor.setHours(cursor.getHours() + 1)
  }

  // ── Member discount + points policy ──────────────────────────────────────
  // TODO(business-decision): implement applyTierPolicy() below and use it here.
  const { total, pointsEarned } = applyTierPolicy(subtotal, durationHours, tier)

  return {
    currency: 'hkd',
    subtotal,
    total,
    amountInCents: Math.round(total * 100),
    pointsEarned,
    durationHours,
    breakdown,
  }
}

/**
 * Decide (a) how much the member is actually CHARGED and (b) how many loyalty
 * points the booking earns.
 *
 * FINALIZED POLICY (revenue-neutral — this is the decision, not a placeholder):
 *  - Every member is charged the FULL calculated price. No tier reduces the
 *    charged amount. `tier.discount` is intentionally NOT applied here.
 *  - Tiers reward members through faster POINTS only:
 *      pointsEarned = subtotal × tier.multiplier
 *      (Amateur 1×, Century 1.5×, Maximum 2×)
 *  - This matches the security skill ("tier multiplier affects points only, never
 *    the charged price") and avoids committing to a margin-cutting discount that
 *    hasn't been decided. If a member-discount is ever introduced, change it here
 *    and nowhere else — this is the single source of truth for the charged amount.
 *
 * `total` is kept an integer (HKD has no sub-dollar pricing here) and never
 * drops below 0.
 */
function applyTierPolicy(
  subtotal: number,
  durationHours: number,
  tier: Pick<Tier, 'discount' | 'multiplier'>,
): { total: number; pointsEarned: number } {
  const total = Math.max(0, Math.round(subtotal)) // full price, no tier discount
  const pointsEarned = Math.round(subtotal * tier.multiplier)
  return { total, pointsEarned }
}

/** Convenience for add-ons priced from the services config (lockers, cue hire). */
export function serviceFee(
  key: keyof ServiceFees,
  services: ServiceFees = DEFAULT_SERVICES,
): number {
  return services[key]
}
