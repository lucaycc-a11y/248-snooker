// ════════════════════════════════════════════════════════════════════════════
// Member Redesign Types
// ════════════════════════════════════════════════════════════════════════════

export type TierValue = 'amateur' | 'century' | 'maximum'

export type TierDefinition = {
  id: string
  name_zh_hk: string
  name_zh_cn: string
  name_en: string
  name_ja: string
}

export type MemberProfile = {
  id: string
  display_name: string | null
  email: string | null
  phone: string | null
  tier: TierValue
  points: number
  member_code: string
  unread_notifications: number
  gender: string | null
  birthday: string | null
  birthday_set: boolean
  birth_month: number | null
}

export type PointsTransaction = {
  id: string
  user_id: string
  points: number
  category: string | null
  description: string
  balance_after: number
  created_at: string
}

export type MemberDashboardData = {
  profile: MemberProfile
}
