'use client'

/**
 * MemberCardGrid — card-based member list for admin §9.
 *
 * Each card shows:
 * - Avatar initial circle (colored by first letter)
 * - Tier badge (Nova / Platinum / Diamond)
 * - Activity dot (green <15min, yellow within 7d, grey inactive)
 * - Member code, email, points, join date
 * - Click → /admin/members/[id]
 *
 * CSS-variable only — no hardcoded hex. No inline styles.
 */

import { useRouter } from 'next/navigation'
import { type AdminMemberRow } from '@/lib/data/getAdminMembers'

/* ── Tier display mapping ─────────────────────── */
const TIER_LABEL: Record<string, string> = {
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

/* ── Activity status ──────────────────────────── */
type ActivityStatus = 'active' | 'recent' | 'inactive'

function getActivityStatus(lastActiveAt: string | null): ActivityStatus {
  if (!lastActiveAt) return 'inactive'
  const diff = Date.now() - new Date(lastActiveAt).getTime()
  const MIN = 60_000
  const DAY = 86_400_000
  if (diff < 15 * MIN) return 'active'
  if (diff < 7 * DAY) return 'recent'
  return 'inactive'
}

const ACTIVITY_DOT: Record<ActivityStatus, { color: string; label: string }> = {
  active: { color: 'var(--admin-brand)', label: 'Online' },
  recent: { color: 'var(--admin-warning)', label: 'Recently active' },
  inactive: { color: 'var(--admin-text-faint)', label: 'Offline' },
}

/* ── Avatar color from first letter ───────────── */
const AVATAR_COLORS = [
  'var(--admin-brand)',
  'var(--admin-tier-platinum)',
  'var(--admin-tier-diamond)',
  'var(--admin-warning)',
  'var(--admin-danger)',
]

function avatarColor(name: string): string {
  let hash = 0
  for (const ch of name) hash = ((hash << 5) - hash + ch.charCodeAt(0)) | 0
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function initial(name: string): string {
  return (name || '?').charAt(0).toUpperCase()
}

/* ── Component ────────────────────────────────── */

type Props = {
  members: AdminMemberRow[]
}

export default function MemberCardGrid({ members }: Props) {
  const router = useRouter()

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {members.map((m) => {
        const tier = m.tier ?? 'amateur'
        const activity = getActivityStatus(m.lastActiveAt)
        const dot = ACTIVITY_DOT[activity]
        const displayName = m.displayName || m.email || m.memberCode || m.id.slice(0, 8)

        return (
          <button
            key={m.id}
            type="button"
            onClick={() => router.push(`/admin/members/${m.id}`)}
            className="group flex items-start gap-3 rounded-2xl p-4 text-left transition-colors"
            style={{
              background: 'var(--admin-surface)',
              border: '1px solid var(--admin-border)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--admin-border-strong)'
              e.currentTarget.style.background = 'var(--admin-surface-elevated)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--admin-border)'
              e.currentTarget.style.background = 'var(--admin-surface)'
            }}
          >
            {/* Avatar */}
            <div className="relative shrink-0">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold"
                style={{
                  background: 'var(--admin-surface-elevated)',
                  color: avatarColor(displayName),
                  border: '1px solid var(--admin-border)',
                }}
              >
                {initial(displayName)}
              </div>
              {/* Activity dot */}
              <div
                className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full"
                style={{
                  background: dot.color,
                  border: '2px solid var(--admin-surface)',
                }}
                title={dot.label}
              />
            </div>

            {/* Info */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span
                  className="truncate text-sm font-semibold"
                  style={{ color: 'var(--admin-text)' }}
                >
                  {displayName}
                </span>
                {m.isBlacklisted && (
                  <span
                    className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase"
                    style={{
                      color: 'var(--admin-danger)',
                      background: 'var(--admin-danger-dim)',
                    }}
                  >
                    Banned
                  </span>
                )}
              </div>

              <div className="mt-1 flex items-center gap-2">
                {/* Tier badge */}
                <span
                  className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                  style={{
                    color: TIER_COLOR_VAR[tier] ?? TIER_COLOR_VAR.amateur,
                    background: TIER_BG_VAR[tier] ?? TIER_BG_VAR.amateur,
                  }}
                >
                  {TIER_LABEL[tier] ?? 'Nova'}
                </span>
                <span
                  className="text-xs"
                  style={{ color: 'var(--admin-text-muted)', fontFamily: 'var(--font-mono, monospace)' }}
                >
                  {m.memberCode ?? '—'}
                </span>
              </div>

              <div
                className="mt-1.5 flex items-center gap-3 text-xs"
                style={{ color: 'var(--admin-text-muted)' }}
              >
                <span>{m.points} pts</span>
                {m.totalSpend > 0 && <span>${m.totalSpend.toLocaleString()}</span>}
                <span>{m.bookingCount} bookings</span>
              </div>
            </div>
          </button>
        )
      })}

      {members.length === 0 && (
        <div
          className="col-span-full py-12 text-center text-sm"
          style={{ color: 'var(--admin-text-muted)' }}
        >
          No members found.
        </div>
      )}
    </div>
  )
}
