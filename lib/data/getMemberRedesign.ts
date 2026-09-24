import { createClient } from '@/lib/supabase/server'
import { type Row, num, str, genId } from './adminReadHelpers'
import { getTierDefinition } from '@/lib/member/tierHelpers'

// ════════════════════════════════════════════════════════════════════════════
// Member Redesign Data Layer — FIXED to use real schema
// Server-only: uses createClient from @/lib/supabase/server
// For types only, import from @/lib/data/memberRedesignTypes
// ════════════════════════════════════════════════════════════════════════════

// Re-export types from the client-safe types file
export type {
  TierValue,
  TierDefinition,
  MemberProfile,
  UserCoupon,
  CouponTemplate,
  PointsTransaction,
  Notification,
  MemberDashboardData,
} from './memberRedesignTypes'

import type {
  TierValue,
  MemberProfile,
  UserCoupon,
  CouponTemplate,
  PointsTransaction,
  Notification,
  MemberDashboardData,
} from './memberRedesignTypes'

// ─────────────────────────────────────────────────────────────────────────────
// § NORMALIZATION FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

function normalizeUserCoupon(row: Row): UserCoupon {
  return {
    id: String(row.id ?? genId('coupon')),
    user_id: String(row.user_id ?? ''),
    template_id: String(row.template_id ?? ''),
    code: str(row, ['code']) ?? '',
    status: (str(row, ['status']) ?? 'available') as UserCoupon['status'],
    discount_type: (str(row, ['discount_type']) ?? 'fixed') as UserCoupon['discount_type'],
    discount_value: num(row, ['discount_value'], 0),
    min_booking_hours: row.min_booking_hours != null ? num(row, ['min_booking_hours'], 0) : null,
    issued_at: str(row, ['issued_at']) ?? new Date().toISOString(),
    expires_at: str(row, ['expires_at']),
    used_at: str(row, ['used_at']),
    booking_id: str(row, ['booking_id']),
    // Joined fields from coupon_templates
    title_zh_hk: str(row, ['title_zh_hk']),
    title_zh_cn: str(row, ['title_zh_cn']),
    title_en: str(row, ['title_en']),
    title_ja: str(row, ['title_ja']),
    description_zh_hk: str(row, ['description_zh_hk']),
    description_zh_cn: str(row, ['description_zh_cn']),
    description_en: str(row, ['description_en']),
    description_ja: str(row, ['description_ja']),
  }
}

function normalizeCouponTemplate(row: Row): CouponTemplate {
  return {
    id: String(row.id ?? genId('template')),
    title_zh_hk: str(row, ['title_zh_hk']) ?? '',
    title_zh_cn: str(row, ['title_zh_cn']) ?? '',
    title_en: str(row, ['title_en']) ?? '',
    title_ja: str(row, ['title_ja']) ?? '',
    description_zh_hk: str(row, ['description_zh_hk']),
    description_zh_cn: str(row, ['description_zh_cn']),
    description_en: str(row, ['description_en']),
    description_ja: str(row, ['description_ja']),
    discount_type: (str(row, ['discount_type']) ?? 'fixed') as CouponTemplate['discount_type'],
    discount_value: num(row, ['discount_value'], 0),
    min_booking_hours: row.min_booking_hours != null ? num(row, ['min_booking_hours'], 0) : null,
    points_cost: row.points_cost != null ? num(row, ['points_cost'], 0) : null,
    active: Boolean(row.active ?? true),
    created_at: str(row, ['created_at']) ?? new Date().toISOString(),
  }
}

function normalizePointsTransaction(row: Row): PointsTransaction {
  return {
    id: String(row.id ?? genId('points')),
    user_id: String(row.user_id ?? ''),
    points: num(row, ['points'], 0),
    balance_after: num(row, ['balance_after'], 0),
    type: str(row, ['type']) ?? 'manual',
    category: str(row, ['category']) ?? undefined,
    description: str(row, ['description']),
    reference_type: str(row, ['reference_type']),
    reference_id: str(row, ['reference_id']),
    created_at: str(row, ['created_at']) ?? new Date().toISOString(),
    booking_id: str(row, ['booking_id']),
  }
}

function normalizeNotification(row: Row): Notification {
  return {
    id: String(row.id ?? genId('notification')),
    user_id: String(row.user_id ?? ''),
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

  let userId: string | null = null
  let authError: string | null = null

  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error) {
      authError = error.message
      // Log auth error
      const { logSiteError } = await import('@/lib/errors/log')
      await logSiteError(
        'member-data-auth-error',
        'error',
        'supabase.auth.getUser() returned an error',
        {
          error_message: error.message,
          error_name: error.name,
          error_status: (error as any).status,
        }
      )
    }

    if (!user) {
      // Log unauthenticated access attempt with session details
      const { logSiteError } = await import('@/lib/errors/log')
      await logSiteError(
        'member-data-no-user',
        'info',
        'getMemberDashboardData called without authenticated user',
        {
          auth_error: authError,
          note: 'This returns null and shows login prompt - expected for unauthenticated users',
        }
      )
      return null
    }

    userId = user.id
  } catch (err) {
    // Log exception during auth check
    const { logSiteError } = await import('@/lib/errors/log')
    await logSiteError(
      'member-data-auth-exception',
      'error',
      'Exception thrown during supabase.auth.getUser()',
      {
        error_message: (err as Error).message,
        error_stack: (err as Error).stack,
      }
    )
    return null
  }

  // Fetch user profile
  let profile: Row = {}
  try {
    const { data } = await supabase.from('users').select('*').eq('id', userId).maybeSingle()
    if (data) profile = data as Row
  } catch (err) {
    // Log profile fetch error but continue with defaults
    const { logSiteError } = await import('@/lib/errors/log')
    await logSiteError(
      'member-data-profile-error',
      'warning',
      'Error fetching user profile from users table',
      {
        user_id: userId,
        error_message: (err as Error).message,
      }
    )
    /* fall through to defaults */
  }

  // Use REAL tier column (not tier_id)
  const tierValue = (str(profile, ['tier']) ?? 'amateur') as TierValue
  const tierDefinition = getTierDefinition(tierValue)

  // Count unread notifications
  let unreadCount = 0
  try {
    const { count } = await supabase
      .from('notification_log')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false)
    unreadCount = count ?? 0
  } catch {
    /* defensive */
  }

  const memberProfile: MemberProfile = {
    id: userId,
    email: (profile.email as string) ?? null,
    display_name:
      (profile.display_name as string) ?? null,
    avatar_url: (profile.avatar_url as string) ?? null,
    phone: (profile.phone as string) ?? null,
    points: num(profile, ['points'], 0), // REAL COLUMN: spendable balance
    tier: tierValue, // REAL COLUMN: 'amateur' | 'century' | 'maximum'
    tier_definition: tierDefinition,
    birth_month: profile.birth_month != null ? num(profile, ['birth_month'], 1) : null,
    birth_month_set_at: str(profile, ['birth_month_set_at']),
    member_code: str(profile, ['member_code']) ?? `248-${userId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8)}`,
    created_at: (profile.created_at as string) ?? null,
    unread_notifications: unreadCount,
  }

  // Fetch user's coupons (REAL user_coupons table, not phantom offers)
  let userCoupons: UserCoupon[] = []
  try {
    const { data } = await supabase
      .from('user_coupons')
      .select(
        `
        *,
        coupon_templates (
          title_zh_hk,
          title_zh_cn,
          title_en,
          title_ja,
          description_zh_hk,
          description_zh_cn,
          description_en,
          description_ja
        )
      `
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100)

    if (Array.isArray(data)) {
      userCoupons = data.map((r) => {
        const template = (r as any).coupon_templates
        return normalizeUserCoupon({
          ...r,
          title_zh_hk: template?.title_zh_hk,
          title_zh_cn: template?.title_zh_cn,
          title_en: template?.title_en,
          title_ja: template?.title_ja,
          description_zh_hk: template?.description_zh_hk,
          description_zh_cn: template?.description_zh_cn,
          description_en: template?.description_en,
          description_ja: template?.description_ja,
        })
      })
    }
  } catch {
    /* defensive */
  }

  // Fetch coupon catalog (templates user can claim/redeem)
  let catalogTemplates: CouponTemplate[] = []
  try {
    const { data } = await supabase
      .from('coupon_templates')
      .select('*')
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(50)
    if (Array.isArray(data)) catalogTemplates = data.map((r) => normalizeCouponTemplate(r as Row))
  } catch {
    /* defensive */
  }

  const now = new Date()
  const coupons = {
    available: userCoupons.filter((c) => c.status === 'available' && (!c.expires_at || new Date(c.expires_at) > now)),
    catalog: catalogTemplates,
    history: userCoupons.filter((c) => c.status === 'used' || c.status === 'expired' || (c.expires_at && new Date(c.expires_at) <= now)),
  }

  // Fetch points transactions (REAL points_ledger)
  let points: PointsTransaction[] = []
  try {
    const { data } = await supabase
      .from('points_ledger')
      .select('*')
      .eq('user_id', userId)
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
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)
    if (Array.isArray(data)) notifications = data.map((r) => normalizeNotification(r as Row))
  } catch {
    /* defensive */
  }

  // Check birthday perk eligibility (if function exists)
  let birthday_perk_eligible = false
  const currentMonth = new Date().getMonth() + 1
  if (memberProfile.birth_month) {
    // Simple check: within 30 days of birth month
    const monthDiff = Math.abs(currentMonth - memberProfile.birth_month)
    birthday_perk_eligible = monthDiff === 0 || monthDiff === 1 || monthDiff === 11
  }

  return {
    profile: memberProfile,
    coupons,
    points,
    notifications,
    birthday_perk_eligible,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § CLIENT ACTIONS (for server actions / route handlers)
// ─────────────────────────────────────────────────────────────────────────────

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

// ════════════════════════════════════════════════════════════════════════════
// STUB FUNCTIONS (TODO: implement)
// ════════════════════════════════════════════════════════════════════════════

export async function claimOffer(offerId: string): Promise<{ success: boolean; error?: string }> {
  // TODO: implement offer claiming logic
  return { success: false, error: 'not_implemented' }
}

export async function redeemOfferWithPoints(
  offerId: string,
  pointsCost: number
): Promise<{ success: boolean; error?: string }> {
  // TODO: implement points redemption logic
  return { success: false, error: 'not_implemented' }
}
