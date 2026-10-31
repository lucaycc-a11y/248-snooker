'use client'

/**
 * MemberDetailTabs — tabbed view for the member detail page.
 * Tabs: 基本資料 | 預約 | 積分 | 活動
 * Styled with the shared admin design system (admin-dash.css: ad-*, cs-seg, md-*).
 */

import { useState } from 'react'

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
  createdAt: string | null
}

type ActivityEntry = {
  actionType: string
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  createdAt: string | null
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
  { key: 'profile', label: '基本資料' },
  { key: 'bookings', label: '預約' },
  { key: 'points', label: '積分' },
  { key: 'activity', label: '活動' },
]

const STATUS: Record<string, { label: string; tone?: 'warn' | 'bad' | 'muted' }> = {
  confirmed: { label: '已確認' },
  completed: { label: '已完成' },
  pending: { label: '待付款', tone: 'warn' },
  payment_review: { label: '付款審核', tone: 'warn' },
  cancelled: { label: '已取消', tone: 'bad' },
  admin_cancelled: { label: '管理員取消', tone: 'bad' },
  refunded: { label: '已退款', tone: 'muted' },
}

const hkDate = (iso: string): string => new Date(iso).toLocaleDateString('zh-HK', { timeZone: 'Asia/Hong_Kong', year: 'numeric', month: '2-digit', day: '2-digit' })
const hkDateTime = (iso: string): string => new Date(iso).toLocaleString('zh-HK', { timeZone: 'Asia/Hong_Kong', hour12: false, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })

export default function MemberDetailTabs({ member }: { member: MemberData }) {
  const [activeTab, setActiveTab] = useState<Tab>('profile')

  return (
    <div className="md-tabs">
      <div className="cs-seg md-seg" role="tablist" aria-label="會員資料">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            className="cs-seg-btn"
            aria-selected={activeTab === tab.key}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
            {tab.key === 'bookings' && member.bookings.length > 0 ? <span className="md-count">{member.bookings.length}</span> : null}
          </button>
        ))}
      </div>

      <section className="admin-card md-pane">
        {activeTab === 'profile' && <ProfileTab member={member} />}
        {activeTab === 'bookings' && <BookingsTab bookings={member.bookings} />}
        {activeTab === 'points' && <PointsTab entries={member.pointsLedger} currentPoints={member.points} />}
        {activeTab === 'activity' && <ActivityTab entries={member.activity} />}
      </section>
    </div>
  )
}

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      className="md-copy"
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setDone(true)
          setTimeout(() => setDone(false), 1500)
        })
      }}
    >
      {done ? '已複製' : '複製'}
    </button>
  )
}

/* ── Profile tab ─────────────────────────────────────── */
function ProfileTab({ member }: { member: MemberData }) {
  const fields: { label: string; value: string; mono?: boolean; copy?: boolean }[] = [
    { label: '電郵', value: member.email ?? '—', copy: !!member.email },
    { label: '電話', value: member.phone ?? '—', copy: !!member.phone },
    { label: '會員編號', value: member.memberCode ?? '—', mono: true, copy: !!member.memberCode },
    { label: '等級', value: member.tierLabel },
    { label: '積分', value: member.points.toLocaleString() },
    { label: '加入日期', value: member.createdAt ? hkDate(member.createdAt) : '—' },
    { label: '最近活動', value: member.lastActiveAt ? formatRelativeTime(member.lastActiveAt) : '從未' },
    { label: '帳戶狀態', value: member.isBlacklisted ? '已封鎖' : '正常' },
  ]
  return (
    <dl className="md-grid">
      {fields.map((f) => (
        <div key={f.label} className="md-field">
          <dt>{f.label}</dt>
          <dd className={f.mono ? 'ad-mono' : undefined}>
            <span className="md-val">{f.value}</span>
            {f.copy ? <CopyButton text={f.value} /> : null}
          </dd>
        </div>
      ))}
    </dl>
  )
}

/* ── Bookings tab ────────────────────────────────────── */
function BookingsTab({ bookings }: { bookings: Booking[] }) {
  if (bookings.length === 0) return <p className="ad-empty">這位會員未有預約</p>
  return (
    <ul className="md-list">
      {bookings.map((b) => {
        const st = STATUS[b.status] ?? { label: b.status, tone: 'muted' as const }
        return (
          <li key={b.id}>
            <a className="md-row" href={`/admin/bookings/${b.id}`}>
              <div className="md-row-main">
                <div className="md-row-top">
                  <b className="ad-mono">{b.reference}</b>
                  <span className="ad-chip" data-tone={st.tone}>{st.label}</span>
                </div>
                <span className="ad-muted">{b.date}{b.tableNumber ? ` · 房${b.tableNumber}` : ''}</span>
              </div>
              <b className="md-amount">HK${b.totalPrice.toLocaleString()}</b>
            </a>
          </li>
        )
      })}
    </ul>
  )
}

/* ── Points tab ──────────────────────────────────────── */
function PointsTab({ entries, currentPoints }: { entries: PointEntry[]; currentPoints: number }) {
  return (
    <div className="md-stack">
      <div className="md-pane-head">
        <h3>積分紀錄</h3>
        <span className="ad-chip">{currentPoints.toLocaleString()} 分</span>
      </div>
      {entries.length === 0 ? (
        <p className="ad-empty">未有積分紀錄</p>
      ) : (
        <ul className="md-list">
          {entries.map((e) => (
            <li key={e.id} className="md-row">
              <div className="md-row-main">
                <span>{e.note ?? e.type}</span>
                <span className="ad-muted">{e.createdAt ? hkDateTime(e.createdAt) : ''}</span>
              </div>
              <b className={e.points > 0 ? 'md-pos' : e.points < 0 ? 'md-neg' : 'ad-muted'}>{e.points > 0 ? '+' : ''}{e.points}</b>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/* ── Activity tab ────────────────────────────────────── */
function ActivityTab({ entries }: { entries: ActivityEntry[] }) {
  if (entries.length === 0) return <p className="ad-empty">沒有後台操作紀錄</p>
  return (
    <div className="md-stack">
      <div className="md-pane-head"><h3>後台操作紀錄</h3></div>
      <ul className="md-list">
        {entries.map((e, i) => (
          <li key={i} className="md-row">
            <div className="md-row-main">
              <span className="ad-chip">{formatActionType(e.actionType)}</span>
              {e.before ? <span className="ad-mono ad-muted md-clip">{JSON.stringify(e.before).slice(0, 100)}</span> : null}
            </div>
            <span className="ad-muted">{e.createdAt ? hkDate(e.createdAt) : ''}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ── Helpers ─────────────────────────────────────────── */
function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const min = 60_000
  const hour = 3_600_000
  const day = 86_400_000
  if (diff < min) return '剛剛'
  if (diff < hour) return `${Math.floor(diff / min)} 分鐘前`
  if (diff < day) return `${Math.floor(diff / hour)} 小時前`
  if (diff < 7 * day) return `${Math.floor(diff / day)} 日前`
  return hkDate(dateStr)
}

function formatActionType(actionType: string): string {
  return actionType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}
