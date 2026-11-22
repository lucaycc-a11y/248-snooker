// Public (SEO) pricing: the rates every anonymous visitor / crawler is allowed to see.
//
// - Base rates come from the world-readable `config` table (getConfig) — never hardcoded.
// - 連訂 (combo) rates live in pricing_v2_config (service-role only) and are included
//   ONLY when pricing v2 is publicly live (enabled && now >= public_from). The admin
//   preview gate in lib/pricing-v2.ts is deliberately NOT used here, so a statically
//   cached SEO page can never leak not-yet-public prices.
// - Cached 5 min (unstable_cache) so pages stay static-friendly; go-live reaches SEO
//   pages within that window.
import { unstable_cache } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getConfig } from '@/lib/data/getConfig'
import { getServiceSupabase } from '@/lib/supabase/service'
import type { PricingPeriod } from '@/lib/data/pricing'

const PERIOD_ORDER = ['morning', 'afternoon', 'evening'] as const

type TFn = (key: string, values?: Record<string, string | number>) => string

async function loadPublicPricingPeriods(): Promise<PricingPeriod[]> {
  const config = await getConfig()
  const ordered = PERIOD_ORDER.map((id) => config.periods.find((p) => p.id === id)).filter(
    (p): p is PricingPeriod => p !== undefined,
  )
  try {
    const db = getServiceSupabase() as unknown as SupabaseClient
    const { data, error } = await db
      .from('pricing_v2_config')
      .select('public_from, combo_min_hours, combo_rates, enabled')
      .eq('id', true)
      .maybeSingle()
    if (error || !data || data.enabled === false) return ordered
    const publicFrom = new Date(data.public_from as string).getTime()
    if (Number.isNaN(publicFrom) || Date.now() < publicFrom) return ordered
    const comboRates = (data.combo_rates ?? {}) as Record<string, number>
    return ordered.map((p) => {
      const combo = comboRates[p.id]
      return typeof combo === 'number' && combo > 0
        ? { ...p, comboRate: combo, comboMinHours: data.combo_min_hours as number }
        : p
    })
  } catch {
    return ordered // fail closed: base rates only
  }
}

export const getPublicPricingPeriods = unstable_cache(loadPublicPricingPeriods, ['public-pricing-periods-v1'], {
  revalidate: 300,
})

/** Lowest hourly rate a visitor can see (base or public combo). */
export function lowestPublicRate(periods: PricingPeriod[]): number | null {
  const rates = periods.flatMap((p) => [p.rate, ...(typeof p.comboRate === 'number' ? [p.comboRate] : [])])
  return rates.length > 0 ? Math.min(...rates) : null
}

/** "上午時段（06:00–12:00）每小時 HK$88，連訂 2 小時起每小時 HK$75；…" — copy lives in messages. */
export function ratesSentence(periods: PricingPeriod[], tPricing: TFn, tSeo: TFn): string {
  return periods
    .map((p) => {
      const base = tSeo('rate_item', {
        name: tPricing(`period_${p.id}_title`),
        time: tPricing(`period_${p.id}_time`),
        rate: String(p.rate),
      })
      const combo =
        typeof p.comboRate === 'number' && p.comboMinHours != null
          ? tSeo('combo_part', { hours: String(p.comboMinHours), combo: String(p.comboRate) })
          : ''
      return base + combo
    })
    .join(tSeo('sep'))
}
