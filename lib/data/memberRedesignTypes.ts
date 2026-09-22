// ════════════════════════════════════════════════════════════════════════════
// Member Redesign Types — shared types for P0-P7 member dashboard
// Client-safe: no server imports, can be used in 'use client' components
// ════════════════════════════════════════════════════════════════════════════

export type TierDefinition = {
  id: string // 'amateur' | 'century' | 'maximum'
  name_zh_hk: string
  name_zh_cn: string
  name_en: string
  name_ja: string
  min_lifetime_points: number
  benefits: {
    discount: number // 0.9 = 10% off
    multiplier: number // 1.5 = 50% bonus points
  }
}

export type MemberProfile = {
  id: string
  email: string | null
  display_name: string | null
  avatar_url: string | null
  phone: string | null
  points: number // available balance
  lifetime_points: number // high-water mark
  tier_id: string
  tier: TierDefinition | null
  birth_month: number | null // 1-12
  birth_month_set_at: string | null
  member_code: string
  created_at: string | null
  unread_notifications: number
}

export type Offer = {
  id: string
  title_zh_hk: string
  title_zh_cn: string
  title_en: string
  title_ja: string
  description_zh_hk: string | null
  description_zh_cn: string | null
  description_en: string | null
  description_ja: string | null
  discount_type: 'fixed' | 'percent' | 'free_hour' | 'birthday_perk'
  discount_value: number
  min_booking_hours: number | null
  state: 'issued' | 'ready' | 'reserved' | 'used' | 'expired'
  acquire_mode: 'auto' | 'claim' | 'points'
  points_cost: number | null
  issued_at: string
  claimed_at: string | null
  expires_at: string | null
  used_at: string | null
}

export type PointsTransaction = {
  id: string
  delta: number
  balance_after: number
  category: 'booking' | 'redeem' | 'refund' | 'manual' | 'birthday'
  description: string
  created_at: string
  booking_id: string | null
  offer_id: string | null
}

export type Notification = {
  id: string
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
  offers: {
    ready: Offer[] // usable now
    issued: Offer[] // need to claim
    catalog: Offer[] // points shop
    history: Offer[] // used/expired
  }
  points: PointsTransaction[]
  notifications: Notification[]
  birthday_perk_eligible: boolean
}
