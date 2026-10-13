/**
 * Pricing configuration types and loader.
 * Single source of truth: config table, key 'pricing_rates'.
 */

import { unstable_cache } from 'next/cache'
import { getPublicSupabase } from '@/lib/supabase/public'

export type PricingPeriod = {
  id: 'morning' | 'afternoon' | 'evening'
  base: number // HK$ per hour
  timeRange: string // "HH:MM-HH:MM"
  startHour: number // parsed from timeRange
  endHour: number // parsed from timeRange (exclusive)
}

export type PricingConfig = {
  currency: string
  morning: { base: number; timeRange: string }
  afternoon: { base: number; timeRange: string }
  evening: { base: number; timeRange: string }
  preauth_deposit: number
  overstay_per_15min: number
}

export type Pricing = {
  periods: PricingPeriod[]
  currency: string
  preauth_deposit: number
  overstay_per_15min: number
}

const DEFAULT_PRICING: Pricing = {
  periods: [
    { id: 'morning', base: 88, timeRange: '06:00-12:00', startHour: 6, endHour: 12 },
    { id: 'afternoon', base: 98, timeRange: '12:00-18:00', startHour: 12, endHour: 18 },
    { id: 'evening', base: 108, timeRange: '18:00-24:00', startHour: 18, endHour: 24 },
  ],
  currency: 'HKD',
  preauth_deposit: 500,
  overstay_per_15min: 50,
}

function parsePeriods(config: Partial<PricingConfig>): PricingPeriod[] {
  const periodIds: Array<'morning' | 'afternoon' | 'evening'> = ['morning', 'afternoon', 'evening']
  return periodIds
    .filter((id) => id in config && config[id])
    .map((id) => {
      const period = config[id] as { base: number; timeRange: string }
      const [start, end] = period.timeRange.split('-').map((t) => parseInt(t.split(':')[0], 10))
      return {
        id,
        base: period.base,
        timeRange: period.timeRange,
        startHour: start,
        endHour: end,
      }
    })
}

async function getPricingRaw(): Promise<Pricing> {
  try {
    const supabase = getPublicSupabase()

    if (!supabase) {
      console.warn('[pricing] no public Supabase client, using defaults')
      return DEFAULT_PRICING
    }

    const { data, error } = await supabase
      .from('config')
      .select('value')
      .eq('key', 'pricing_rates')
      .maybeSingle()

    if (error || !data?.value) {
      console.warn('[pricing] config not found, using defaults')
      return DEFAULT_PRICING
    }

    const config = typeof data.value === 'string' ? JSON.parse(data.value) : data.value
    const periods = parsePeriods(config as Partial<PricingConfig>)

    return {
      periods,
      currency: config.currency || 'HKD',
      preauth_deposit: config.preauth_deposit || 500,
      overstay_per_15min: config.overstay_per_15min || 50,
    }
  } catch (err) {
    console.error('[pricing] load failed:', err)
    return DEFAULT_PRICING
  }
}

export const getPricing = unstable_cache(getPricingRaw, ['pricing-config'], {
  revalidate: 60, // 1 minute
  tags: ['pricing'],
})
