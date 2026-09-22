import { createClient } from '@/lib/supabase/server'
import { type Row, num, str, genId } from './adminReadHelpers'

// ════════════════════════════════════════════════════════════════════════════
// Member Redesign Data Layer — extends getMember.ts with new P0-P7 features
// Server-only: uses createClient from @/lib/supabase/server
// For types only, import from @/lib/data/memberRedesignTypes
// ════════════════════════════════════════════════════════════════════════════

// Re-export types from the client-safe types file
export type {
  TierDefinition,
  MemberProfile,
  Offer,
  PointsTransaction,
  Notification,
  MemberDashboardData,
} from './memberRedesignTypes'

import type {
  TierDefinition,
  MemberProfile,
  Offer,
  PointsTransaction,
  Notification,
  MemberDashboardData,
} from './memberRedesignTypes'

// ─────────────────────────────────────────────────────────────────────────────
// § HELPER — Load Tier Definitions from Config
// ─────────────────────────────────────────────────────────────────────────────

let tierCache: TierDefinition[] | null = null

async function loadTiers(supabase: Awaited<ReturnType<typeof createClient>>): Promise<TierDefinition[]> {
  if (tierCache) return tierCache

  try {
    const { data } = await supabase.from('config').select('value').eq('key', 'member_tiers').single()
    if (data?.value && Array.isArray(data.value)) {
      tierCache = data.value as TierDefinition[]
      return tierCache
    }
  } catch {
    /* fall through to default */
  }

  // Fallback tiers if config load fails
  tierCache = [
    {
      id: 'amateur',
      name_zh_hk: '新星會員',
      name_zh_cn: '新星会员',
      name_en: 'Nova',
      name_ja: 'ノヴァ',
      min_lifetime_points: 0,
      benefits: { discount: 1.0, multiplier: 1.0 },
    },
    {
      id: 'century',
      name_zh_hk: '鉑金會員',
      name_zh_cn: '铂金会员',
      name_en: 'Platinum',
      name_ja: 'プラチナ',
      min_lifetime_points: 500,
      benefits: { discount: 0.95, multiplier: 1.5 },
    },
    {
      id: 'maximum',
      name_zh_hk: '鑽石會員',
      name_zh_cn: '钻石会员',
      name_en: 'Diamond',
      name_ja: 'ダイヤモンド',
      min_lifetime_points: 2000,
      benefits: { discount: 0.9, multiplier: 2.0 },
    },
  ]
  return tierCache
}

// ─────────────────────────────────────────────────────────────────────────────
// § NORMALIZATION FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

function normalizeOffer(row: Row): Offer {
  return {
    id: String(row.id ?? genId('offer')),
    title_zh_hk: str(row, ['title_zh_hk']) ?? '',
    title_zh_cn: str(row, ['title_zh_cn']) ?? '',
    title_en: str(row, ['title_en']) ?? '',
    title_ja: str(row, ['title_ja']) ?? '',
    description_zh_hk: str(row, ['description_zh_hk']),
    description_zh_cn: str(row, ['description_zh_cn']),
    description_en: str(row, ['description_en']),
    description_ja: str(row, ['description_ja']),
    discount_type: (str(row, ['discount_type']) ?? 'fixed') as Offer['discount_type'],
    discount_value: num(row, ['discount_value'], 0),
    min_booking_hours: row.min_booking_hours != null ? num(row, ['min_booking_hours'], 0) : null,
    state: (str(row, ['state']) ?? 'issued') as Offer['state'],
    acquire_mode: (str(row, ['acquire_mode']) ?? 'auto') as Offer['acquire_mode'],
    points_cost: row.points_cost != null ? num(row, ['points_cost'], 0) : null,
    issued_at: str(row, ['issued_at']) ?? new Date().toISOString(),
    claimed_at: str(row, ['claimed_at']),
    expires_at: str(row, ['expires_at']),
    used_at: str(row, ['used_at']),
  }
}

function normalizePointsTransaction(row: Row): PointsTransaction {
  return {
    id: String(row.id ?? genId('points')),
    delta: num(row, ['delta'], 0),
    balance_after: num(row, ['balance_after'], 0),
    category: (str(row, ['category']) ?? 'manual') as PointsTransaction['category'],
    description: str(row, ['description']) ?? '',
    created_at: str(row, ['created_at']) ?? new Date().toISOString(),
    booking_id: str(row, ['booking_id']),
    offer_id: str(row, ['offer_id']),
  }
}

function normalizeNotification(row: Row): Notification {
  return {
    id: String(row.id ?? genId('notification')),
    type: (str(row, ['type']) ?? 'system') as Notification['type'],
    title_zh_hk: str(row, ['title_zh_hk']) ?? '',
    title_zh_cn: str(row, ['title_zh_cn']) ?? '',
    title_en: str(row, ['title_en']) ?? '',
    title_ja: str(row, ['title_ja']) ?? '',
    message_zh_hk: str(row, ['message_zh_hk']),
    message_zh_cn: str(row, ['message_zh_cn']),
    message_en: str(row, ['message_en']),
    message_ja: str(row, ['message_ja']),
    read: Boolean(row.read),
    action_url: str(row, ['action_url']),
    created_at: str(row, ['created_at']) ?? new Date().toISOString(),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § MAIN DATA FETCHER
// ─────────────────────────────────────────────────────────────────────────────

export async function getMemberDashboardData(): Promise<MemberDashboardData | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  // Load tier definitions
  const tiers = await loadTiers(supabase)

  // Fetch user profile
  let profile: Row = {}
  try {
    const { data } = await supabase.from('users').select('*').eq('id', user.id).maybeSingle()
    if (data) profile = data as Row
  } catch {
    /* fall through to defaults */
  }

  const tierId = str(profile, ['tier_id']) ?? 'amateur'
  const tier = tiers.find((t) => t.id === tierId) ?? tiers[0]

  // Count unread notifications
  let unreadCount = 0
  try {
    const { count } = await supabase
      .from('notification_log')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('read', false)
    unreadCount = count ?? 0
  } catch {
    /* defensive */
  }

  const memberProfile: MemberProfile = {
    id: user.id,
    email: (profile.email as string) ?? user.email ?? null,
    display_name:
      (profile.display_name as string) ?? (user.user_metadata?.full_name as string) ?? user.email?.split('@')[0] ?? null,
    avatar_url: (profile.avatar_url as string) ?? (user.user_metadata?.avatar_url as string) ?? null,
    phone: (profile.phone as string) ?? null,
    points: num(profile, ['points'], 0),
    lifetime_points: num(profile, ['lifetime_points'], 0),
    tier_id: tierId,
    tier,
    birth_month: profile.birth_month != null ? num(profile, ['birth_month'], 1) : null,
    birth_month_set_at: str(profile, ['birth_month_set_at']),
    member_code: str(profile, ['member_code']) ?? `248-${user.id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8)}`,
    created_at: (profile.created_at as string) ?? user.created_at ?? null,
    unread_notifications: unreadCount,
  }

  // Fetch offers (categorized)
  let allOffers: Offer[] = []
  try {
    const { data } = await supabase
      .from('offers')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100)
    if (Array.isArray(data)) allOffers = data.map((r) => normalizeOffer(r as Row))
  } catch {
    /* defensive */
  }

  const now = new Date()
  const offers = {
    ready: allOffers.filter((o) => o.state === 'ready' && (!o.expires_at || new Date(o.expires_at) > now)),
    issued: allOffers.filter((o) => o.state === 'issued' && (!o.expires_at || new Date(o.expires_at) > now)),
    catalog: allOffers.filter(
      (o) => o.acquire_mode === 'points' && o.state === 'issued' && (!o.expires_at || new Date(o.expires_at) > now)
    ),
    history: allOffers.filter((o) => o.state === 'used' || o.state === 'expired' || (o.expires_at && new Date(o.expires_at) <= now)),
  }

  // Fetch points transactions
  let points: PointsTransaction[] = []
  try {
    const { data } = await supabase
      .from('points_ledger')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)
    if (Array.isArray(data)) points = data.map((r) => normalizePointsTransaction(r as Row))
  } catch {
    /* defensive */
  }

  // Fetch notifications
  let notifications: Notification[] = []
  try {
    const { data } = await supabase
      .from('notification_log')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)
    if (Array.isArray(data)) notifications = data.map((r) => normalizeNotification(r as Row))
  } catch {
    /* defensive */
  }

  // Check birthday perk eligibility
  let birthday_perk_eligible = false
  try {
    const { data } = await supabase.rpc('check_birthday_perk_eligibility', { p_user_id: user.id })
    birthday_perk_eligible = Boolean(data)
  } catch {
    /* defensive */
  }

  return {
    profile: memberProfile,
    offers,
    points,
    notifications,
    birthday_perk_eligible,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § CLIENT ACTIONS (for server actions / route handlers)
// ─────────────────────────────────────────────────────────────────────────────

export async function redeemOfferWithPoints(offerId: string): Promise<{ success: boolean; error?: string; new_balance?: number }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'unauthorized' }

  try {
    const { data, error } = await supabase.rpc('redeem_offer_with_points', {
      p_user_id: user.id,
      p_offer_id: offerId,
    })
    if (error) throw error
    return data as { success: boolean; error?: string; new_balance?: number }
  } catch (err: any) {
    return { success: false, error: err.message ?? 'unknown_error' }
  }
}

export async function claimOffer(offerId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'unauthorized' }

  try {
    const { data, error } = await supabase.rpc('claim_offer', {
      p_user_id: user.id,
      p_offer_id: offerId,
    })
    if (error) throw error
    return data as { success: boolean; error?: string }
  } catch (err: any) {
    return { success: false, error: err.message ?? 'unknown_error' }
  }
}

export async function markNotificationRead(notificationId: string): Promise<boolean> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return false

  try {
    const { error } = await supabase
      .from('notification_log')
      .update({ read: true })
      .eq('id', notificationId)
      .eq('user_id', user.id)
    return !error
  } catch {
    return false
  }
}

export async function markAllNotificationsRead(): Promise<boolean> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return false

  try {
    const { error } = await supabase.from('notification_log').update({ read: true }).eq('user_id', user.id).eq('read', false)
    return !error
  } catch {
    return false
  }
}

export async function setBirthMonth(month: number): Promise<{ success: boolean; error?: string }> {
  if (month < 1 || month > 12) {
    return { success: false, error: 'invalid_month' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'unauthorized' }

  try {
    // Check if already set
    const { data: userData } = await supabase.from('users').select('birth_month, birth_month_set_at').eq('id', user.id).single()

    if (userData?.birth_month != null) {
      return { success: false, error: 'already_set' }
    }

    // Set birth month (locked forever)
    const { error } = await supabase
      .from('users')
      .update({ birth_month: month, birth_month_set_at: new Date().toISOString() })
      .eq('id', user.id)

    if (error) throw error
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message ?? 'unknown_error' }
  }
}
