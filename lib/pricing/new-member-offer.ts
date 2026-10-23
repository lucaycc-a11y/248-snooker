import 'server-only'
import { getPricing } from '@/lib/pricing/config'
import { getServiceSupabase } from '@/lib/supabase/service'

// "New members from HK$X" — derived, never hardcoded. Every input lives in the
// database:
//   • lowest hourly rate     → config.pricing_rates (via getPricing)
//   • new-member promo code  → promotion_codes (active, audience = new_users)
//   • welcome Space Credit   → config.points_system: signup_bonus_points are
//                              converted in blocks (convert_points_block →
//                              convert_credits_per_block)
// If no active new-member code exists the offer simply has no promo part; if the
// result is not a real saving the function returns null so no copy is shown.

export type NewMemberOffer = {
  floorPrice: number
  basePrice: number
  promoCode: string | null
  promoDiscount: number
  creditAmount: number
}

type PointsSystem = {
  signup_bonus_points?: number
  convert_points_block?: number
  convert_credits_per_block?: number
}

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN
  return Number.isFinite(n) ? n : 0
}

function isPointsSystem(v: unknown): v is PointsSystem {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

export async function getNewMemberOffer(): Promise<NewMemberOffer | null> {
  const pricing = await getPricing()
  if (pricing.periods.length === 0) return null
  const basePrice = Math.min(...pricing.periods.map((p) => p.base))

  const service = getServiceSupabase()
  const nowIso = new Date().toISOString()

  const [{ data: promos }, { data: cfg }] = await Promise.all([
    service
      .from('promotion_codes')
      .select('code, discount_type, discount_value, max_discount, valid_from, valid_until, max_uses, used_count')
      .eq('is_active', true)
      .eq('audience', 'new_users'),
    service.from('config').select('value').eq('key', 'points_system').maybeSingle(),
  ])

  let promoCode: string | null = null
  let promoDiscount = 0
  for (const p of promos ?? []) {
    if (p.valid_from && p.valid_from > nowIso) continue
    if (p.valid_until && p.valid_until < nowIso) continue
    if (p.max_uses !== null && p.used_count >= p.max_uses) continue
    let amount = p.discount_type === 'percentage'
      ? Math.round((basePrice * num(p.discount_value)) / 100)
      : num(p.discount_value)
    const cap = num(p.max_discount)
    if (p.discount_type === 'percentage' && cap > 0) amount = Math.min(amount, cap)
    if (amount > promoDiscount) {
      promoDiscount = amount
      promoCode = p.code
    }
  }

  let creditAmount = 0
  const ps: unknown = cfg?.value
  if (isPointsSystem(ps)) {
    const bonus = num(ps.signup_bonus_points)
    const block = num(ps.convert_points_block)
    const perBlock = num(ps.convert_credits_per_block)
    if (block > 0) creditAmount = Math.floor(bonus / block) * perBlock
  }

  const floorPrice = Math.max(0, basePrice - promoDiscount - creditAmount)
  if (promoDiscount + creditAmount <= 0) return null

  return { floorPrice, basePrice, promoCode, promoDiscount, creditAmount }
}
