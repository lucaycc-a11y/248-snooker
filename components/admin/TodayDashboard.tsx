'use client'

/**
 * TodayDashboard — the prototype's vToday().
 *
 * Head row (date + 示例時間 + test toggle + 手動新增預約), four stat circles
 * with Bebas numerals, the 7-day chart, then one card per table holding that
 * table's booking tiles.
 */

import { useRouter } from 'next/navigation'
import { Calendar, Clock, CreditCard, Plus } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  bookingPhase,
  INACTIVE_BOOKING_STATUSES,
  type AdminTodayBooking,
  type AdminTodayData,
} from '@/lib/admin/today'
import BookingVolumeChart from './BookingVolumeChart'

type Props = {
  data: AdminTodayData
  includeTest: boolean
}

// Prototype stat icons are cal / clock / today / card — and its `cal` and
// `today` paths are identical, so both use Calendar.
const STAT_ICONS: [LucideIcon, LucideIcon, LucideIcon, LucideIcon] = [
  Calendar,
  Clock,
  Calendar,
  CreditCard,
]

/** Prototype `STATUS` map — [label, tone], exactly as `space8-admin.html`. */
const STATUS_MAP: Record<string, [string, 'good' | 'warn' | 'bad' | 'info' | 'mute']> = {
  confirmed: ['已確認', 'good'],
  pending: ['待付款', 'warn'],
  payment_review: ['付款待審核', 'warn'],
  payment_failed: ['付款失敗', 'bad'],
  expired: ['已過期', 'mute'],
  cancelled: ['已取消', 'mute'],
  admin_cancelled: ['已取消（後台）', 'mute'],
  refunded: ['已退款', 'info'],
}

const DEFAULT_STATUS: [string, 'mute'] = ['未知', 'mute']

function statusOf(status: string): [string, 'good' | 'warn' | 'bad' | 'info' | 'mute'] {
  return STATUS_MAP[status] ?? DEFAULT_STATUS
}

function money(n: number): string {
  return `HK$${Number(n || 0).toLocaleString('en-US')}`
}

/** "+8526128 4501" / "+85261284501" -> "6128 4501". Falls back to the raw value. */
function formatPhone(raw: string | null): string {
  if (!raw) return ''
  const digits = raw.replace(/\D/g, '')
  if (digits.length < 8) return raw
  const local = digits.slice(-8)
  return `${local.slice(0, 4)} ${local.slice(4)}`
}

function endTimeOf(b: AdminTodayBooking): string {
  if (b.endTime) return b.endTime
  const [h, m] = (b.startTime ?? '0:0').split(':').map(Number)
  const total = (h || 0) * 60 + (m || 0) + Math.round(b.durationHours * 60)
  const hh = Math.floor(total / 60) % 24
  const mm = total % 60
  return `${hh}:${String(mm).padStart(2, '0')}`
}

function tileClass(b: AdminTodayBooking, nowMinutes: number): string {
  if (INACTIVE_BOOKING_STATUSES.has(b.status)) return 'admin-tile off'
  const phase = bookingPhase(b, nowMinutes)
  if (phase === '進行中') return 'admin-tile live'
  if (b.status === 'pending') return 'admin-tile dim'
  return 'admin-tile'
}

/** "10月7日（三）" — the prototype's dlabel(). */
function dateLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const weekday = ['日', '一', '二', '三', '四', '五', '六'][
    new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  ]
  return `${m}月${d}日（${weekday}）`
}

function TodayIncomeCard({ bookings, tableCount }: { bookings: AdminTodayBooking[]; tableCount: number }) {
  const paid = bookings.filter((b) => b.status === 'confirmed')
  const unpaid = bookings.filter((b) => b.status === 'pending')
  const revenue = paid.reduce((n, b) => n + b.price, 0)
  const pendingAmount = unpaid.reduce((n, b) => n + b.price, 0)
  const average = paid.length ? Math.round(revenue / paid.length) : 0
  const tables = Array.from({ length: tableCount }, (_, i) => i + 1).map((t) => {
    const rows = paid.filter((b) => b.tableNumber === t)
    return { t, count: rows.length, amount: rows.reduce((n, b) => n + b.price, 0) }
  })
  return (
    <section className="sp-card" style={{ margin: '0 0 16px' }} aria-label="今日收入">
      <header className="sp-card-head">
        <span className="sp-card-kicker" data-cms-key="admin.today.income.title">今日收入</span>
        <span className="sp-card-range" data-cms-key="admin.today.income.note">已確認預約</span>
      </header>
      <div className="sp-income-main">
        <b className="sp-big admin-num">{money(revenue)}</b>
        <dl className="sp-kv">
          <div><dt data-cms-key="admin.today.income.count">已確認</dt><dd className="admin-num">{paid.length} 張</dd></div>
          <div><dt data-cms-key="admin.today.income.avg">平均每張</dt><dd className="admin-num">{money(average)}</dd></div>
          <div><dt data-cms-key="admin.today.income.pending">待付款</dt><dd className="admin-num">{unpaid.length ? money(pendingAmount) : '—'}</dd></div>
        </dl>
      </div>
      {tables.length > 0 ? (
        <ul className="sp-methods">
          {tables.map((x) => (
            <li key={x.t}>
              <span>枱 {x.t}</span>
              <i style={{ width: `${Math.max(4, Math.round((x.amount / Math.max(1, revenue)) * 100))}%` }} aria-hidden />
              <b className="admin-num">{money(x.amount)}</b>
              <small>{x.count} 張</small>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}

export default function TodayDashboard({ data, includeTest }: Props) {
  const router = useRouter()
  const { stats, bookings, week, tableCount, nowMinutes, nowTime, date, error } = data

  const statItems: { value: number; label: string; Icon: LucideIcon }[] = [
    { value: stats.total, label: '今日預約', Icon: STAT_ICONS[0] },
    { value: stats.live, label: '進行中', Icon: STAT_ICONS[1] },
    { value: stats.upcoming, label: '未開始', Icon: STAT_ICONS[2] },
    { value: stats.unpaid, label: '待付款', Icon: STAT_ICONS[3] },
  ]

  return (
    <>
      {/* Head */}
      <div className="admin-head" style={{ borderBottom: 'none', padding: 0 }}>
        <div>
          <h2>{dateLabel(date)}</h2>
          <p className="admin-sub">
            現在 {nowTime} · 按枱號與開始時間排列
          </p>
        </div>
        <div className="admin-row">
          <button
            type="button"
            role="switch"
            aria-checked={includeTest}
            className="admin-switch"
            onClick={() => router.push(includeTest ? '/admin/today' : '/admin/today?test=1')}
            data-cms-key="admin.today.show_test"
            title="顯示測試預約"
          />
          <span className="admin-sub" data-cms-key="admin.today.show_test_label">
            顯示測試預約
          </span>
          <button
            type="button"
            className="admin-btn primary"
            onClick={() => router.push('/admin/bookings?new=1')}
            data-cms-key="admin.dock.new_booking"
          >
            <Plus size={18} aria-hidden />
            手動新增預約
          </button>
        </div>
      </div>

      {/* A failed read is not an empty day — say so before the zeros. */}
      {error ? (
        <div
          className="admin-empty"
          role="alert"
          data-cms-key="admin.today.load_error"
          style={{ color: 'var(--admin-danger, #f87171)' }}
        >
          {error}
        </div>
      ) : null}

      {/* Stats */}
      <div className="admin-stats">
        {statItems.map(({ value, label, Icon }) => (
          <div className="admin-stat" key={label}>
            <i className="ci">
              <Icon size={20} aria-hidden />
            </i>
            <div className="tx">
              <b>{value}</b>
              <span data-cms-key={`admin.today.stat.${label}`}>{label}</span>
            </div>
          </div>
        ))}
      </div>


      {/* Today's income — same card language as Spark's income card */}
      <TodayIncomeCard bookings={bookings} tableCount={tableCount} />

      {/* 7-day volume */}
      <BookingVolumeChart week={week} />

      {/* One card per table */}
      <div className="admin-stack">
        {Array.from({ length: tableCount }, (_, i) => i + 1).map((t) => {
          const rows = bookings.filter((b) => b.tableNumber === t)
          return (
            <section className="admin-card flat" key={t}>
              <div className="admin-head">
                <h3 style={{ margin: 0 }}>枱 {t}</h3>
                <span className="admin-muted">{rows.length} 個預約</span>
              </div>
              <div className="admin-tiles">
                {rows.length ? (
                  rows.map((b) => {
                    const phase = bookingPhase(b, nowMinutes)
                    return (
                      <button
                        type="button"
                        key={b.id}
                        className={tileClass(b, nowMinutes)}
                        onClick={() => router.push(`/admin/bookings/${b.id}`)}
                        data-cms-key="admin.today.tile"
                      >
                        <span className="t1">
                          {b.startTime}–{endTimeOf(b)}
                        </span>
                        <span className="t2">
                          {b.userName ?? '—'}
                          {b.isTest ? (
                            <>
                              {' '}
                              <span className="admin-tag warn">測試</span>
                            </>
                          ) : null}
                        </span>
                        <span className="t3">{formatPhone(b.userPhone)}</span>
                        <span className="tb">
                          <span className={`admin-pill ${statusOf(b.status)[1]}`}>
                            {statusOf(b.status)[0]}
                          </span>
                          {phase ? <span className="t3">{phase}</span> : null}
                          <b>{money(b.price)}</b>
                        </span>
                      </button>
                    )
                  })
                ) : (
                  <div className="admin-empty">此枱今日沒有預約</div>
                )}
              </div>
            </section>
          )
        })}
      </div>
    </>
  )
}
