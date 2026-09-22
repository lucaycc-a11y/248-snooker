// ════════════════════════════════════════════════════════════════════════════
// Member Redesign Types — shared types for P0-P7 member dashboard
// Client-safe: no server imports, can be used in 'use client' components
// FIXED: Uses real schema (tier, points) not phantom columns (tier_id, lifetime_points)
// ════════════════════════════════════════════════════════════════════════════

// Real tier values from DB CHECK constraint
export type TierValue = 'amateur' | 'century' | 'maximum'

export type TierDefinition = {
  id: TierValue
  name_zh_hk: string
  name_zh_cn: string
  name_en: string
  name_ja: string
  min_points?: number // Threshold (if we implement auto-upgrade later)
  benefits?: {
    discount?: number // 0.9 = 10% off
    multiplier?: number // 1.5 = 50% bonus points
  }
}

export type MemberProfile = {
  id: string
  email: string | null
  display_name: string | null
  avatar_url: string | null
  phone: string | null
  points: number // REAL COLUMN: available spendable balance
  tier: TierValue // REAL COLUMN: 'amateur' | 'century' | 'maximum'
  tier_definition: TierDefinition | null // Populated from config or helpers
  birth_month: number | null // 1-12
  birth_month_set_at: string | null
  member_code: string
  created_at: string | null
  unread_notifications: number
}

// Use real user_coupons schema instead of phantom offers table
export type UserCoupon = {
  id: string
  user_id: string
  template_id: string
  code: string
  status: 'available' | 'used' | 'expired' | 'reserved'
  discount_type: 'fixed' | 'percent' | 'free_hour'
  discount_value: number
  min_booking_hours: number | null
  issued_at: string
  expires_at: string | null
  used_at: string | null
  booking_id: string | null
  // Joined from coupon_templates
  title_zh_hk: string | null
  title_zh_cn: string | null
  title_en: string | null
  title_ja: string | null
  description_zh_hk: string | null
  description_zh_cn: string | null
  description_en: string | null
  description_ja: string | null
}

// Use real coupon_templates schema
export type CouponTemplate = {
  id: string
  title_zh_hk: string
  title_zh_cn: string
  title_en: string
  title_ja: string
  description_zh_hk: string | null
  description_zh_cn: string | null
  description_en: string | null
  description_ja: string | null
  discount_type: 'fixed' | 'percent' | 'free_hour'
  discount_value: number
  min_booking_hours: number | null
  points_cost: number | null // If redeemable with points
  active: boolean
  created_at: string
}

export type PointsTransaction = {
  id: string
  user_id: string
  points: number // Delta (positive = earn, negative = spend)
  balance_after: number
  type: string // Real values: 'booking', 'manual' (more may be added)
  category?: string // Optional categorization
  description: string | null
  reference_type: string | null // 'booking', 'coupon', etc.
  reference_id: string | null
  created_at: string
  booking_id: string | null
}

export type Notification = {
  id: string
  user_id: string
  type: 'offer' | 'booking' | 'system' | 'promo'
  title_zh_hk: string
  title_zh_cn: string
  title_en: string
  title_ja: string
  message_zh_hk: string | null
  message_zh_cn: string | null
  message_en: string | null
  message_ja: string | null
  read: boolean
  action_url: string | null
  created_at: string
}

export type MemberDashboardData = {
  profile: MemberProfile
  coupons: {
    available: UserCoupon[] // usable now
    catalog: CouponTemplate[] // templates user can claim/redeem
    history: UserCoupon[] // used/expired
  }
  points: PointsTransaction[]
  notifications: Notification[]
  birthday_perk_eligible: boolean
}
