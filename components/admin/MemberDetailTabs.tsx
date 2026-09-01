'use client'

/**
 * MemberDetailTabs — client-side tabbed view for member detail (§9.2).
 *
 * Tabs: Profile | Bookings | Points | Activity
 * CSS-variable only — no inline hex, no shadows.
 * Uses active-tab indicator with animated underline.
 */

import { useState, useCallback } from 'react'

type Tab = 'profile' | 'bookings' | 'points' | 'activity'

type Booking = {
  id: string
  reference: string
  date: string
  status: string
  totalPrice: number
  tableNumber: string | null
}

type PointEntry = {
  id: string
  points: number
  type: string
  note: string | null
  createdAt: string
}

type ActivityEntry = {
  actionType: string
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  createdAt: string
}

type MemberData = {
  id: string
  displayName: string
  email: string | null
  phone: string | null
  memberCode: string | null
  tier: string
  tierLabel: string
  points: number
  isBlacklisted: boolean
  createdAt: string | null
  lastActiveAt: string | null
  bookings: Booking[]
  pointsLedger: PointEntry[]
  activity: ActivityEntry[]
}

const TABS: { key: Tab; label: string }[] = [
  { key: 'profile', label: 'Profile' },
  { key: 'bookings', label: 'Bookings' },
  { key: 'points', label: 'Points' },
  { key: 'activity', label: 'Activity' },
]

const STATUS_COLOR: Record<string, string> = {
  confirmed: 'var(--admin-brand)',
  pending: 'var(--admin-warning)',
  admin_cancelled: 'var(--admin-danger)',
  refunded: 'var(--admin-text-muted)',
  cancelled: 'var(--admin-danger)',
  completed: 'var(--admin-brand)',
}

export default function MemberDetailTabs({ member }: { member: MemberData }) {
  const [activeTab, setActiveTab] = useState<Tab>('profile')

  return (
    <div className="flex flex-col">
      {/* ── Tab bar ──────────────────────────────────────────── */}
      <div
        className="flex gap-1 overflow-x-auto rounded-xl p-1"
        style={{
          background: 'var(--admin-surface)',
          border: '1px solid var(--admin-border)',
        }}
        role="tablist"
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.key)}
              className="relative shrink-0 rounded-lg px-4 py-2 text-xs font-semibold transition-colors"
              style={{
                color: isActive ? 'var(--admin-bg)' : 'var(--admin-text-muted)',
                background: isActive ? 'var(--admin-brand)' : 'transparent',
              }}
            >
              {tab.label}
              {tab.key === 'bookings' && member.bookings.length > 0 && (
                <span
                  className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold"
                  style={{
                    color: isActive ? 'var(--admin-bg)' : 'var(--admin-text-muted)',
                    background: isActive
                      ? 'rgba(0,0,0,0.2)'
                      : 'var(--admin-surface-elevated)',
                  }}
                >
                  {member.bookings.length}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ── Tab content ──────────────────────────────────────── */}
      <div
        className="mt-4 rounded-2xl p-4"
        style={{
          background: 'var(--admin-surface)',
          border: '1px solid var(--admin-border)',
        }}
      >
        {activeTab === 'profile' && <ProfileTab member={member} />}
        {activeTab === 'bookings' && <BookingsTab bookings={member.bookings} />}
        {activeTab === 'points' && <PointsTab entries={member.pointsLedger} currentPoints={member.points} />}
        {activeTab === 'activity' && <ActivityTab entries={member.activity} />}
      </div>
    </div>
  )
}

/* ── Profile tab ─────────────────────────────────────── */
function ProfileTab({ member }: { member: MemberData }) {
  const fields = [
    { label: 'Email', value: member.email ?? '—' },
    { label: 'Phone', value: member.phone ?? '—' },
    { label: 'Member code', value: member.memberCode ?? '—', mono: true },
    { label: 'Tier', value: member.tierLabel },
    { label: 'Points', value: member.points.toLocaleString() },
    { label: 'Joined', value: member.createdAt ? new Date(member.createdAt).toLocaleDateString() : '—' },
    {
      label: 'Last active',
      value: member.lastActiveAt
        ? formatRelativeTime(member.lastActiveAt)
        : 'Never',
    },
  ]

  return (
    <div className="flex flex-col">
      <h3
        className="mb-3 text-sm font-bold"
        style={{ color: 'var(--admin-text)' }}
      >
        Profile Details
      </h3>
      <div className="grid gap-0.5">
        {fields.map((f) => (
          <div
            key={f.label}
            className="flex items-center justify-between border-b py-2.5"
            style={{ borderColor: 'var(--admin-border)' }}
          >
            <span className="text-xs" style={{ color: 'var(--admin-text-muted)' }}>
              {f.label}
            </span>
            <span
              className={`text-xs font-medium ${f.mono ? 'font-[var(--font-mono,monospace)]' : ''}`}
              style={{ color: 'var(--admin-text)' }}
            >
              {f.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Bookings tab ────────────────────────────────────── */
function BookingsTab({ bookings }: { bookings: Booking[] }) {
  if (bookings.length === 0) {
    return (
      <div className="py-8 text-center text-xs" style={{ color: 'var(--admin-text-muted)' }}>
        No bookings yet.
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      <h3
        className="mb-3 text-sm font-bold"
        style={{ color: 'var(--admin-text)' }}
      >
        Booking History
      </h3>
      <div className="grid gap-0.5">
        {bookings.map((b) => (
          <div
            key={b.id}
            className="flex items-center justify-between border-b py-2.5"
            style={{ borderColor: 'var(--admin-border)' }}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span
                  className="text-xs font-medium"
                  style={{ color: 'var(--admin-text)', fontFamily: 'var(--font-mono, monospace)' }}
                >
                  {b.reference}
                </span>
                <span
                  className="rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase"
                  style={{
                    color: STATUS_COLOR[b.status] ?? 'var(--admin-text-muted)',
                    background: 'var(--admin-surface-elevated)',
                  }}
                >
                  {b.status}
                </span>
              </div>
              <div className="mt-0.5 text-xs" style={{ color: 'var(--admin-text-muted)' }}>
                {b.date}
                {b.tableNumber && <> · Table {b.tableNumber}</>}
              </div>
            </div>
            <span
              className="text-xs font-semibold"
              style={{ color: 'var(--admin-text)' }}
            >
              HK${b.totalPrice.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Points tab ──────────────────────────────────────── */
function PointsTab({ entries, currentPoints }: { entries: PointEntry[]; currentPoints: number }) {
  return (
    <div className="flex flex-col">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold" style={{ color: 'var(--admin-text)' }}>
          Points Ledger
        </h3>
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
          style={{
            color: 'var(--admin-brand)',
            background: 'var(--admin-brand-dim)',
          }}
        >
          {currentPoints.toLocaleString()} pts
        </span>
      </div>
      {entries.length === 0 ? (
        <div className="py-8 text-center text-xs" style={{ color: 'var(--admin-text-muted)' }}>
          No points activity yet.
        </div>
      ) : (
        <div className="grid gap-0.5">
          {entries.map((e) => (
            <div
              key={e.id}
              className="flex items-center justify-between border-b py-2.5"
              style={{ borderColor: 'var(--admin-border)' }}
            >
              <div className="min-w-0 flex-1">
                <span className="text-xs" style={{ color: 'var(--admin-text)' }}>
                  {e.note ?? e.type}
                </span>
                <div className="text-[10px]" style={{ color: 'var(--admin-text-muted)' }}>
                  {e.createdAt ? new Date(e.createdAt).toLocaleString() : ''}
                </div>
              </div>
              <span
                className="text-xs font-bold"
                style={{
                  color:
                    e.points > 0
                      ? 'var(--admin-brand)'
                      : e.points < 0
                        ? 'var(--admin-danger)'
                        : 'var(--admin-text-muted)',
                }}
              >
                {e.points > 0 ? '+' : ''}{e.points}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Activity tab ────────────────────────────────────── */
function ActivityTab({ entries }: { entries: ActivityEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="py-8 text-center text-xs" style={{ color: 'var(--admin-text-muted)' }}>
        No activity recorded.
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      <h3
        className="mb-3 text-sm font-bold"
        style={{ color: 'var(--admin-text)' }}
      >
        Admin Activity
      </h3>
      <div className="grid gap-0.5">
        {entries.map((e, i) => (
          <div
            key={i}
            className="flex items-start justify-between border-b py-2.5"
            style={{ borderColor: 'var(--admin-border)' }}
          >
            <div className="min-w-0 flex-1">
              <span
                className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase"
                style={{
                  color: 'var(--admin-brand)',
                  background: 'var(--admin-brand-dim)',
                }}
              >
                {formatActionType(e.actionType)}
              </span>
              {e.before && (
                <div
                  className="mt-1 text-[10px]"
                  style={{
                    color: 'var(--admin-text-muted)',
                    fontFamily: 'var(--font-mono, monospace)',
                  }}
                >
                  {JSON.stringify(e.before).slice(0, 100)}
                </div>
              )}
            </div>
            <span className="text-[10px] whitespace-nowrap" style={{ color: 'var(--admin-text-muted)' }}>
              {e.createdAt ? new Date(e.createdAt).toLocaleDateString() : ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Helpers ─────────────────────────────────────────── */
function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const min = 60_000
  const hour = 3_600_000
  const day = 86_400_000

  if (diff < min) return 'Just now'
  if (diff < hour) return `${Math.floor(diff / min)}m ago`
  if (diff < day) return `${Math.floor(diff / hour)}h ago`
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`
  return new Date(dateStr).toLocaleDateString()
}

function formatActionType(actionType: string): string {
  return actionType
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}
