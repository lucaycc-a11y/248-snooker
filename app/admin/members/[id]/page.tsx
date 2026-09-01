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
import MemberActions from '@/components/admin/MemberActions'
import MemberDetailTabs from '@/components/admin/MemberDetailTabs'

/* ── Tier display ─────────────────────────────────────── */
const TIER_LABELS: Record<string, string> = {
  amateur: 'Nova',
  century: 'Platinum',
  maximum: 'Diamond',
}

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
        .select('id, member_code, email, display_name, phone, tier, points, is_blacklisted, created_at, last_active_at')
        .eq('id', id)
        .maybeSingle(),

      service
        .from('bookings')
        .select('id, booking_reference, date, status, total_price, table_number')
        .eq('user_id', id)
        .order('date', { ascending: false })
        .limit(50),

      service
        .from('points_ledger')
        .select('id, points, type, note, created_at')
        .eq('user_id', id)
        .order('created_at', { ascending: false })
        .limit(50),

      service
        .from('admin_action_log')
        .select('id, action_type, before_jsonb, after_jsonb, created_at')
        .eq('target_id', id)
        .eq('target_table', 'users')
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
  const tierLabel = TIER_LABELS[tier] ?? 'Nova'
  const displayName = str(user, ['display_name']) ?? str(user, ['email']) ?? id.slice(0, 8)

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
      reference: str(b, ['booking_reference']) ?? String(b.id).slice(0, 8),
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
      actionType: str(a, ['action_type']) ?? 'unknown',
      before: a.before_jsonb as Record<string, unknown> | null,
      after: a.after_jsonb as Record<string, unknown> | null,
      createdAt: str(a, ['created_at']),
    })),
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 md:px-6">
      {/* ── Header ──────────────────────────────────────────── */}
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h1
            className="text-2xl font-bold"
            style={{ color: 'var(--admin-text)' }}
          >
            {displayName}
          </h1>
          {/* Tier badge */}
          <span
            className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide"
            style={{
              color: TIER_COLOR_VAR[tier] ?? TIER_COLOR_VAR.amateur,
              background: TIER_BG_VAR[tier] ?? TIER_BG_VAR.amateur,
            }}
          >
            {tierLabel}
          </span>
          {user.is_blacklisted === true && (
            <span
              className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase"
              style={{
                color: 'var(--admin-danger)',
                background: 'var(--admin-danger-dim)',
              }}
            >
              Banned
            </span>
          )}
        </div>
      </header>

      {/* ── Risk badge + quick stats ────────────────────────── */}
      <div
        className="flex flex-wrap items-center gap-4 rounded-2xl px-4 py-3 text-sm"
        style={{
          background: 'var(--admin-surface)',
          border: '1px solid var(--admin-border)',
          color: 'var(--admin-text-muted)',
        }}
      >
        <RiskBadgeInline
          totalBookings={riskStats.totalBookings}
          cancelledBookings={riskStats.cancelledBookings}
          waivedFees={riskStats.waivedFees}
        />
        <span className="h-4 w-px" style={{ background: 'var(--admin-border)' }} aria-hidden="true" />
        <span>
          <strong style={{ color: 'var(--admin-text)' }}>{riskStats.totalBookings}</strong> bookings
        </span>
        <span>
          <strong style={{ color: 'var(--admin-text)' }}>{memberData.points}</strong> pts
        </span>
        {memberData.email && (
          <span className="truncate" style={{ color: 'var(--admin-text-muted)' }}>
            {memberData.email}
          </span>
        )}
      </div>

      {/* ── Actions ─────────────────────────────────────────── */}
      <MemberActions
        userId={id}
        tier={tier}
        isBlacklisted={memberData.isBlacklisted}
      />

      {/* ── Tabs ────────────────────────────────────────────── */}
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

  const cfg = {
    low: { color: 'var(--admin-brand)', bg: 'var(--admin-brand-dim)' },
    medium: { color: 'var(--admin-warning)', bg: 'var(--admin-warning-dim)' },
    high: { color: 'var(--admin-danger)', bg: 'var(--admin-danger-dim)' },
  }[level]

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
      style={{ color: cfg.color, background: cfg.bg }}
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: cfg.color }} />
      Risk: {level} ({score}%)
    </span>
  )
}
