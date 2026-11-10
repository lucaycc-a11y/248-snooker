// Pricing v2 (連訂) + 20-minute booking cutoff, with the admin-only gate.
//
// Active for a caller when: now >= pricing_v2_config.public_from (go-live), OR
// the request's session belongs to an active admin. Everything is decided on the
// server; the browser only receives the already-gated result.
//
// The data lives in public.pricing_v2_config (service-role only, NOT in the
// world-readable `config` table) so new prices cannot leak before go-live.

import { unstable_noStore as noStore } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getServiceSupabase } from '@/lib/supabase/service'

// public.pricing_v2_config / public.app_versions are new and not yet in
// database.types.ts (regenerate types to drop this cast).
const db = () => getServiceSupabase() as unknown as SupabaseClient
import { getAdminData } from '@/lib/data/getAdmin'
import type { PricingPeriod } from '@/lib/data/pricing'
import { SLOT_BOOKING_CUTOFF_MINUTES } from '@/lib/booking/slot-cutoff'

export type PricingV2Config = {
  publicFrom: Date
  cutoffMinutes: number
  comboMinHours: number
  comboRates: Record<string, number>
}

export async function loadPricingV2Config(): Promise<PricingV2Config | null> {
  noStore() // the answer depends on the clock and viewer — never cache
  try {
    const { data, error } = await db()
      .from('pricing_v2_config')
      .select('public_from, cutoff_minutes, combo_min_hours, combo_rates')
      .eq('id', true)
      .maybeSingle()
    if (error || !data) return null
    const publicFrom = new Date(data.public_from as string)
    if (Number.isNaN(publicFrom.getTime())) return null
    return {
      publicFrom,
      cutoffMinutes: data.cutoff_minutes as number,
      comboMinHours: data.combo_min_hours as number,
      comboRates: (data.combo_rates ?? {}) as Record<string, number>,
    }
  } catch {
    return null
  }
}

async function callerIsAdmin(): Promise<boolean> {
  try {
    return (await getAdminData()) != null
  } catch {
    return false // no request context (cron/webhook) → not an admin session
  }
}

/** The v2 config if it applies to the current caller, otherwise null. */
export async function getActivePricingV2(now: Date = new Date()): Promise<PricingV2Config | null> {
  const cfg = await loadPricingV2Config()
  if (!cfg) return null
  if (now.getTime() >= cfg.publicFrom.getTime()) return cfg
  return (await callerIsAdmin()) ? cfg : null
}

/** Attach 連訂 rates to periods when v2 applies to the caller. */
export async function applyPricingV2(periods: PricingPeriod[]): Promise<PricingPeriod[]> {
  const cfg = await getActivePricingV2()
  if (!cfg) return periods
  return periods.map((p) => {
    const combo = cfg.comboRates[p.id]
    return typeof combo === 'number' && combo > 0
      ? { ...p, comboRate: combo, comboMinHours: cfg.comboMinHours }
      : p
  })
}

/** Booking cutoff (minutes after slot start) for the current caller. */
export async function getBookingCutoffMinutes(): Promise<number> {
  const cfg = await getActivePricingV2()
  return cfg ? cfg.cutoffMinutes : SLOT_BOOKING_CUTOFF_MINUTES
}
