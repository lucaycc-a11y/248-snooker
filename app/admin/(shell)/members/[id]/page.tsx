/**
 * Admin Members/[id] detail page — spec §9.2.
 *
 * Tabs: Profile | Bookings | Points | Activity
 * Actions: adjust points, change tier, ban/unban
 * Risk badge computed from cancellation_log + bookings.
 *
 * Design system: admin-theme.css variables only.
 * Tier naming: Nova (amateur), Platinum (century), Diamond (maximum).
 */

import { notFound } from 'next/navigation'
import { getServiceSupabase } from '@/lib/supabase/service'
import { num, str, type Row } from '@/lib/data/adminReadHelpers'
import { getHiddenUserList } from '@/lib/data/getHiddenUserIds'
import MemberActions from '@/components/admin/MemberActions'
import MemberDetailTabs from '@/components/admin/MemberDetailTabs'
import { tierShortLabel } from '@/lib/member/tierDisplay'

/* ── Tier display ─────────────────────────────────────── */
const TIER_COLOR_VAR: Record<string, string> = {
  amateur: 'var(--admin-tier-nova)',
  century: 'var(--admin-tier-platinum)',
  maximum: 'var(--admin-tier-diamond)',
}

const TIER_BG_VAR: Record<string, string> = {
  amateur: 'var(--admin-tier-nova-dim)',
  century: 'var(--admin-tier-platinum-dim)',
  maximum: 'var(--admin-tier-diamond-dim)',
}

/* ── Server-side data fetch ───────────────────────────── */
async function getMemberDetail(id: string) {
  const service = getServiceSupabase()

  // Parallel fetches for all tab data
  const [userRes, bookingsRes, pointsRes, activityRes, cancellationRes, waivedRes] =
    await Promise.all([
      service
        .from('users')
        .select('id, member_code, email, display_name, phone, tier, points, is_blacklisted, created_at')
        .eq('id', id)
        .maybeSingle(),

      service
        .from('bookings')
        .select('id, human_code, booking_reference, date, status, total_price, table_number')
        .eq('user_id', id)
        .eq('is_test', false)
        .order('date', { ascending: false })
        .limit(50),

      service
        .from('points_ledger')
        .select('id, points, type, note, created_at')
        .eq('user_id', id)
        .order('created_at', { ascending: false })
        .limit(50),

      // Audit rows touching this member — audit_log is the real table.
      service
        .from('audit_log')
        .select('action, before_value, after_value, created_at')
        .eq('target_id', id)
        .order('created_at', { ascending: false })
        .limit(20),

      // Count cancelled bookings for this user
      service
        .from('cancellation_log')
        .select('id, compensation_type', { count: 'exact' })
        .in(
          'booking_id',
          (
            await service
              .from('bookings')
              .select('id')
              .eq('user_id', id)
          ).data?.map((b: Row) => String(b.id)) ?? [],
        ),

      // Count waived fees (compensation_type = 'none')
      service
        .from('cancellation_log')
        .select('id', { count: 'exact' })
        .eq('compensation_type', 'none')
        .in(
          'booking_id',
          (
            await service
              .from('bookings')
              .select('id')
              .eq('user_id', id)
          ).data?.map((b: Row) => String(b.id)) ?? [],
        ),
    ])

  if (!userRes.data) return null

  const user = userRes.data as Row
  const bookings = (bookingsRes.data ?? []) as Row[]
  const pointsLedger = (pointsRes.data ?? []) as Row[]
  const activity = (activityRes.data ?? []) as Row[]
  const totalBookings = bookings.length
  const cancelledBookings = cancellationRes.count ?? 0
  const waivedFees = waivedRes.count ?? 0

  return {
    user,
    bookings,
    pointsLedger,
    activity,
    riskStats: { totalBookings, cancelledBookings, waivedFees },
  }
}

/* ── Page component ───────────────────────────────────── */
export default async function AdminMemberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const result = await getMemberDetail(id)
  if (!result) notFound()

  const { user, bookings, pointsLedger, activity, riskStats } = result
  const tier = str(user, ['tier']) ?? 'amateur'
  const tierLabel = tierShortLabel(tier)
  const displayName = str(user, ['display_name']) ?? str(user, ['email']) ?? id.slice(0, 8)
  // Direct links to a hidden account must still say so — the list filters them
  // out, but a deep link lands here regardless.
  const hidden = await getHiddenUserList().catch(() => ({ ids: new Set<string>(), reasons: new Map<string, string>() }))
  const isHidden = hidden.ids.has(id)

  // Format the member data for the client tab component
  const memberData = {
    id,
    displayName,
    email: str(user, ['email']),
    phone: str(user, ['phone']),
    memberCode: str(user, ['member_code']),
    tier,
    tierLabel,
    points: num(user, ['points'], 0),
    isBlacklisted: user.is_blacklisted === true,
    createdAt: str(user, ['created_at']),
    lastActiveAt: str(user, ['last_active_at']),
    bookings: bookings.map((b) => ({
      id: String(b.id),
      reference: str(b, ['human_code', 'booking_reference']) ?? String(b.id).slice(0, 8),
      date: str(b, ['date']) ?? '',
      status: str(b, ['status']) ?? 'pending',
      totalPrice: num(b, ['total_price'], 0),
      tableNumber: str(b, ['table_number']),
    })),
    pointsLedger: pointsLedger.map((p) => ({
      id: String(p.id),
      points: num(p, ['points'], 0),
      type: str(p, ['type']) ?? 'Points',
      note: str(p, ['note']),
      createdAt: str(p, ['created_at']),
    })),
    activity: activity.map((a) => ({
      actionType: str(a, ['action']) ?? 'unknown',
      before: a.before_value as Record<string, unknown> | null,
      after: a.after_value as Record<string, unknown> | null,
      createdAt: str(a, ['created_at']),
    })),
  }

  const initial = (displayName.trim().slice(0, 1) || '?').toUpperCase()
  const hkDay = (iso: string | null): string => (iso ? new Date(iso).toLocaleDateString('zh-HK', { timeZone: 'Asia/Hong_Kong', year: 'numeric', month: '2-digit', day: '2-digit' }) : '—')
  const lastActive = (() => {
    if (!memberData.lastActiveAt) return '從未'
    const diff = Date.now() - new Date(memberData.lastActiveAt).getTime()
    if (diff < 3_600_000) return `${Math.max(1, Math.floor(diff / 60_000))} 分鐘前`
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小時前`
    if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)} 日前`
    return hkDay(memberData.lastActiveAt)
  })()

  return (
    <main className="md-page">
      <section className="admin-card md-hero">
        <span className="md-av" aria-hidden="true">{initial}</span>
        <div className="md-hero-main">
          <div className="md-name-row">
            <h1>{displayName}</h1>
            <span
              className="md-tier"
              style={{
                color: TIER_COLOR_VAR[tier] ?? TIER_COLOR_VAR.amateur,
                background: TIER_BG_VAR[tier] ?? TIER_BG_VAR.amateur,
              }}
            >
              {tierLabel}
            </span>
            {user.is_blacklisted === true && (
              <span className="ad-chip" data-tone="bad" data-cms-key="admin.members.badge_blacklist">黑名單</span>
            )}
            {isHidden && (
              <span className="ad-chip" data-tone="warn" data-cms-key="admin.members.badge_hidden" title={hidden.reasons.get(id) ?? undefined}>已隱藏</span>
            )}
            <RiskBadgeInline
              totalBookings={riskStats.totalBookings}
              cancelledBookings={riskStats.cancelledBookings}
              waivedFees={riskStats.waivedFees}
            />
          </div>
          <p className="md-sub">
            {memberData.memberCode ? <span className="ad-mono">{memberData.memberCode}</span> : null}
            {memberData.email ? <span>{memberData.email}</span> : null}
            {memberData.phone ? <span>{memberData.phone}</span> : null}
          </p>
        </div>
      </section>

      <section className="md-stats" aria-label="重點數字">
        <div className="admin-card md-stat" data-cms-key="admin.members.detail_bookings"><span>預約</span><b>{riskStats.totalBookings}</b></div>
        <div className="admin-card md-stat" data-cms-key="admin.members.detail_points"><span>積分</span><b>{memberData.points.toLocaleString()}</b></div>
        <div className="admin-card md-stat"><span>加入日期</span><b>{hkDay(memberData.createdAt)}</b></div>
        <div className="admin-card md-stat"><span>最近活動</span><b>{lastActive}</b></div>
      </section>

      <MemberActions
        userId={id}
        tier={tier}
        isBlacklisted={memberData.isBlacklisted}
      />

      <MemberDetailTabs member={memberData} />
    </main>
  )
}

/* ── Inline risk badge (server-safe, no hooks) ─────── */
function RiskBadgeInline({
  totalBookings,
  cancelledBookings,
  waivedFees,
}: {
  totalBookings: number
  cancelledBookings: number
  waivedFees: number
}) {
  const score =
    totalBookings === 0
      ? 0
      : Math.round(((cancelledBookings * 2 + waivedFees * 3) / totalBookings) * 100)

  let level: 'low' | 'medium' | 'high' = 'low'
  if (score > 30) level = 'high'
  else if (score >= 10) level = 'medium'

  const tone = level === 'high' ? 'bad' : level === 'medium' ? 'warn' : undefined

  const levelLabel =
    level === 'high' ? '高' : level === 'medium' ? '中' : '低'

  return (
    <span className="ad-chip" data-tone={tone} data-cms-key="admin.members.risk_badge">
      風險：{levelLabel}（{score}%）
    </span>
  )
}
