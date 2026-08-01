import { getPublicSupabase } from '@/lib/supabase/public'
import {
  DEFAULT_CONFIG,
  DEFAULT_PERIODS,
  DEFAULT_SERVICES,
  DEFAULT_TIERS,
  pricingRatesToPeriods,
  type PricingPeriod,
  type PricingRates,
  type ServiceFees,
  type SiteConfig,
  type Tier,
} from './pricing'

export type { SiteConfig } from './pricing'

// Read a single raw config row by key, with a typed fallback. Reusable for
// non-pricing config (e.g. legal.updatedAt) without widening SiteConfig.
export async function getConfigValue<T>(key: string, fallback: T): Promise<T> {
  const supabase = getPublicSupabase()
  if (!supabase) return fallback
  try {
    const { data, error } = await supabase
      .from('config')
      .select('value')
      .eq('key', key)
      .maybeSingle()
    if (error || !data) return fallback
    return (data.value as T) ?? fallback
  } catch {
    return fallback
  }
}

// Read site config from the Supabase `config` table (keys: site, pricing_rates, tiers).
// Falls back to bundled DEFAULT_CONFIG when Supabase is unreachable or the table
// is empty, so pages always render. Prices are NEVER hardcoded in components —
// they flow from here.
export async function getConfig(): Promise<SiteConfig> {
  const supabase = getPublicSupabase()
  if (!supabase) return DEFAULT_CONFIG

  try {
    const { data, error } = await supabase
      .from('config')
      .select('key, value')
      .in('key', ['site', 'pricing_rates', 'tiers'])

    if (error || !data) return DEFAULT_CONFIG

    const rows = Object.fromEntries(data.map((r) => [r.key, r.value])) as Record<
      string,
      Record<string, unknown> | unknown[]
    >

    const site = (rows.site ?? {}) as Record<string, unknown>
    const pricingRates = (rows.pricing_rates ?? {}) as Record<string, unknown>

    // Convert pricing_rates (morning/afternoon/evening → {base, discount, timeRange})
    // into the PricingPeriod[] array the rest of the codebase expects.
    const periods: PricingPeriod[] =
      typeof pricingRates === 'object' && !Array.isArray(pricingRates) && Object.keys(pricingRates).length
        ? pricingRatesToPeriods(pricingRates as PricingRates)
        : DEFAULT_PERIODS

    const tiers = (Array.isArray(rows.tiers) && rows.tiers.length
      ? rows.tiers
      : DEFAULT_TIERS) as Tier[]

    const services = {
      ...DEFAULT_SERVICES,
      ...((pricingRates.services as Partial<ServiceFees>) ?? {}),
    } as ServiceFees

    // The "base" hourly price used by simple callers = cheapest period rate.
    const pricePerHour = periods.reduce(
      (min, p) => (p.rate < min ? p.rate : min),
      periods[0]?.rate ?? DEFAULT_CONFIG.pricePerHour,
    )

    return {
      pricePerHour,
      currency: (site.currency as string) ?? DEFAULT_CONFIG.currency,
      maxHours:
        (site.maxHours as number) ?? (pricingRates.maxHours as number) ?? DEFAULT_CONFIG.maxHours,
      openHour: (site.openHour as number) ?? DEFAULT_CONFIG.openHour,
      closeHour: (site.closeHour as number) ?? DEFAULT_CONFIG.closeHour,
      periods,
      tiers,
      services,
    }
  } catch {
    // Network/parse failure — never let config break a page render.
    return DEFAULT_CONFIG
  }
}
