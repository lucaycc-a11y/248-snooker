// Shared pricing / tier / services domain types + bundled defaults.
//
// These defaults mirror the booking-flow skill (afternoon/late HK$60, evening
// HK$80; tiers 0/500/1500) and the seed rows in
// supabase/migrations/0001_pages_foundation.sql. They are the FALLBACK used when
// Supabase is unreachable or the `config` table is empty, so every page renders
// correctly before the migration is run. Once the migration runs, getConfig()
// returns the live DB values instead.

export type PricingPeriod = {
  id: 'morning' | 'afternoon' | 'evening'
  rate: number // HK$ per hour
  // Optional long-booking discount: when a booking's TOTAL duration is >=
  // discountMinHours, every hour billed in this period uses discountRate
  // instead of rate. Both must be present together to take effect.
  discountRate?: number
  discountMinHours?: number
  start: string // 'HH:MM'
  end: string // 'HH:MM'
  days: 'weekday' | 'weekend' | 'all'
}

export type Tier = {
  id: 'amateur' | 'century' | 'maximum'
  minPts: number
  discount: number // 1.0 = no discount, 0.9 = 10% off
  multiplier: number // points earn multiplier
}

export type ServiceFees = {
  locker_single: number
  locker_monthly: number
  cue_pro_per_hour: number
  overtime_per_15min: number
  drinks_min: number
  drinks_max: number
}

export type SiteConfig = {
  // Flat fields kept for backwards-compatibility with existing callers
  // (e.g. the booking page expects pricePerHour/currency/maxHours/open/close).
  pricePerHour: number
  currency: string
  maxHours: number
  openHour: number
  closeHour: number
  // Rich fields used by the pricing + member pages.
  periods: PricingPeriod[]
  tiers: Tier[]
  services: ServiceFees
}

export const DEFAULT_PERIODS: PricingPeriod[] = [
  { id: 'morning', rate: 88, discountRate: 78, discountMinHours: 2, start: '06:00', end: '12:00', days: 'all' },
  { id: 'afternoon', rate: 98, discountRate: 88, discountMinHours: 2, start: '12:00', end: '16:00', days: 'all' },
  { id: 'evening', rate: 108, start: '16:00', end: '24:00', days: 'all' },
]

// Tiers no longer cut the charged price (see lib/pricing.ts's applyTierPolicy
// — revenue-neutral by design): `discount` is kept in the type for backwards
// compatibility but is always 1.0. Tier value is delivered entirely through
// the points multiplier + perks (signup bonus, welcome gifts, vouchers, etc.),
// documented in the member-facing copy, not through a price cut here.
export const DEFAULT_TIERS: Tier[] = [
  { id: 'amateur', minPts: 0, discount: 1.0, multiplier: 1 },
  { id: 'century', minPts: 800, discount: 1.0, multiplier: 1.5 },
  { id: 'maximum', minPts: 6000, discount: 1.0, multiplier: 2 },
]

export const DEFAULT_SERVICES: ServiceFees = {
  locker_single: 20,
  locker_monthly: 600,
  cue_pro_per_hour: 30,
  overtime_per_15min: 50,
  drinks_min: 8,
  drinks_max: 18,
}

export const DEFAULT_CONFIG: SiteConfig = {
  pricePerHour: 60,
  currency: 'HKD',
  maxHours: 6,
  openHour: 0,
  closeHour: 24,
  periods: DEFAULT_PERIODS,
  tiers: DEFAULT_TIERS,
  services: DEFAULT_SERVICES,
}

// Resolve which tier a points balance falls into, plus progress to the next.
export function resolveTier(points: number, tiers: Tier[] = DEFAULT_TIERS) {
  const sorted = [...tiers].sort((a, b) => a.minPts - b.minPts)
  let current = sorted[0]
  for (const tier of sorted) {
    if (points >= tier.minPts) current = tier
  }
  const next = sorted.find((t) => t.minPts > current.minPts) ?? null
  const span = next ? next.minPts - current.minPts : 0
  const progressed = points - current.minPts
  const progress = next && span > 0 ? Math.min(1, progressed / span) : 1
  const pointsToNext = next ? Math.max(0, next.minPts - points) : 0
  return { current, next, progress, pointsToNext }
}
