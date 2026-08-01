import { NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { getServiceSupabase } from '@/lib/supabase/service'
import type { SiteConfig, Tier } from '@/lib/data/pricing'

// Admin-only config writer. GET is intentionally omitted — the settings page
// reads current values directly via getConfig()/getConfigValue() as a Server
// Component (lib/data/getConfig.ts). This route only ever runs for an active
// admin (checked again here, independent of app/admin/layout.tsx, since API
// routes are reachable without rendering the page).

type ConfigKey = 'site' | 'pricing_rates' | 'tiers' | 'booking_rules'

const CONFIG_KEYS: ConfigKey[] = ['site', 'pricing_rates', 'tiers', 'booking_rules']

type SiteValue = Pick<SiteConfig, 'currency' | 'maxHours' | 'openHour' | 'closeHour'>
type PricingRatesValue = Record<string, { base: number; discount: number; timeRange: string }>
type BookingRulesValue = { refundCutoffHours: number }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function validateSite(value: unknown): SiteValue | null {
  if (!isRecord(value)) return null
  const { currency, maxHours, openHour, closeHour } = value
  if (typeof currency !== 'string' || currency.trim() === '') return null
  if (!isFiniteNumber(maxHours) || maxHours <= 0) return null
  if (!isFiniteNumber(openHour) || openHour < 0 || openHour > 24) return null
  if (!isFiniteNumber(closeHour) || closeHour < 0 || closeHour > 24) return null
  return { currency, maxHours, openHour, closeHour }
}

function validatePricingRates(value: unknown): PricingRatesValue | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  const obj = value as Record<string, unknown>
  const validated: PricingRatesValue = {}
  const periodIds = ['morning', 'afternoon', 'evening']
  for (const id of periodIds) {
    const p = obj[id]
    if (typeof p !== 'object' || p === null) return null
    const period = p as Record<string, unknown>
    if (typeof period.base !== 'number' || !Number.isFinite(period.base) || period.base < 0) return null
    if (typeof period.discount !== 'number' || !Number.isFinite(period.discount) || period.discount < 0) return null
    if (typeof period.timeRange !== 'string') return null
    validated[id] = { base: period.base, discount: period.discount, timeRange: period.timeRange }
  }
  return validated
}

const TIER_IDS: Tier['id'][] = ['amateur', 'century', 'maximum']

function validateTier(value: unknown): Tier | null {
  if (!isRecord(value)) return null
  const { id, minPts, discount, multiplier } = value
  if (typeof id !== 'string' || !TIER_IDS.includes(id as Tier['id'])) return null
  if (!isFiniteNumber(minPts) || minPts < 0) return null
  if (!isFiniteNumber(discount) || discount < 0 || discount > 1) return null
  if (!isFiniteNumber(multiplier) || multiplier < 0) return null
  return { id: id as Tier['id'], minPts, discount, multiplier }
}

function validateTiers(value: unknown): Tier[] | null {
  if (!Array.isArray(value) || value.length !== TIER_IDS.length) return null
  const validated: Tier[] = []
  const seenIds = new Set<string>()
  for (const t of value) {
    const tier = validateTier(t)
    if (!tier || seenIds.has(tier.id)) return null
    seenIds.add(tier.id)
    validated.push(tier)
  }
  if (!TIER_IDS.every((id) => seenIds.has(id))) return null
  return validated
}

function validateBookingRules(value: unknown): BookingRulesValue | null {
  if (!isRecord(value)) return null
  const { refundCutoffHours } = value
  if (!isFiniteNumber(refundCutoffHours) || refundCutoffHours < 0) return null
  return { refundCutoffHours }
}

function validateByKey(key: ConfigKey, value: unknown): unknown | null {
  switch (key) {
    case 'site':
      return validateSite(value)
    case 'pricing_rates':
      return validatePricingRates(value)
    case 'tiers':
      return validateTiers(value)
    case 'booking_rules':
      return validateBookingRules(value)
  }
}

export async function POST(req: Request) {
  try {
    const admin = await getAdminData()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body: unknown = await req.json()
    if (!isRecord(body) || typeof body.key !== 'string' || !CONFIG_KEYS.includes(body.key as ConfigKey)) {
      return NextResponse.json({ error: 'Invalid key' }, { status: 400 })
    }
    const key = body.key as ConfigKey

    const validated = validateByKey(key, body.value)
    if (validated === null) {
      return NextResponse.json({ error: `Invalid value for "${key}"` }, { status: 400 })
    }

    const service = getServiceSupabase()

    const { data: existing } = await service.from('config').select('value').eq('key', key).maybeSingle()

    const { error: upsertError } = await service
      .from('config')
      .upsert({ key, value: validated, updated_at: new Date().toISOString() })
    if (upsertError) {
      console.error('[admin/config] upsert failed', upsertError)
      return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }

    await service.from('audit_log').insert({
      admin_user_id: admin.userId,
      admin_email: admin.email,
      action: 'config_update',
      target_table: 'config',
      target_id: key,
      before_value: existing?.value ?? null,
      after_value: validated,
    })

    return NextResponse.json({ success: true, value: validated })
  } catch (err) {
    console.error('[admin/config] unexpected error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
