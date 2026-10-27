'use client'

/**
 * AdminHome — the default /admin landing page.
 *
 * Greeting + attention strip, KPI cards (with a 7-day sparkline), the room
 * timetable for the chosen day, and the latest bookings. All figures come from
 * getAdminHome, which excludes test bookings and hidden users.
 */

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertTriangle, CalendarClock, ChevronLeft, ChevronRight, Wallet } from 'lucide-react'
import type { AdminHomeData } from '@/lib/data/getAdminHome'
import { dateLabel, minutesOf, money, shiftDate } from '@/lib/admin/today'
import AdminStatusBadge from './AdminStatusBadge'
import AdminPageHead from './AdminPageHead'

type Props = {
  data: AdminHomeData
  adminName: string | null
}

const INACTIVE = new Set(['cancelled', 'admin_cancelled', 'expired', 'refunded', 'payment_failed'])

function greeting(nowTime: string): string {
  const hour = Number(nowTime.split(':')[0])
  if (hour < 6) return '夜深了'
  if (hour < 12) return '早晨'
  if (hour < 18) return '午安'
  return '晚上好'
}

function formatPhone(raw: string | null): string {
  if (!raw) return ''
  const digits = raw.replace(/\D/g, '')
  const local = digits.startsWith('852') ? digits.slice(3) : digits
  return local.length === 8 ? `${local.slice(0, 4)} ${local.slice(4)}` : raw
}

function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(...values, 1)
  const width = 120
  const height = 36
  const step = values.length > 1 ? width / (values.length - 1) : width
  const points = values.map((v, i) => `${(i * step).toFixed(1)},${(height - (v / max) * (height - 4) - 2).toFixed(1)}`)
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      width="100%"
      height={height}
      role="img"
      aria-label="最近 7 日收入走勢"
      style={{ display: 'block', maxWidth: '100%' }}
    >
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke="var(--admin-green)"
        vectorEffect="non-scaling-stroke"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function Timetable({ data }: { data: AdminHomeData }) {
  const startMin = Math.max(0, Math.floor(data.openHour)) * 60
  const endMin = Math.min(24 * 60, Math.max(startMin + 60, Math.floor(data.closeHour) * 60))
  const span = endMin - startMin
  const hours: number[] = []
  for (let m = startMin; m <= endMin; m += 120) hours.push(m)
  const isToday = data.date === data.todayDate
  const nowPct = ((data.nowMinutes - startMin) / span) * 100
  const rooms = Array.from({ length: data.tableCount }, (_, i) => i + 1)

  return (
    <div className="ah-timetable" role="table" aria-label="房間時間表">
      <div className="ah-tt-axis" role="row">
        <span className="ah-tt-label" />
        <div className="ah-tt-track">
          {hours.map((m) => (
            <span key={m} className="ah-tt-hour" style={{ left: `${((m - startMin) / span) * 100}%` }}>
              {String(Math.floor(m / 60) % 24).padStart(2, '0')}:00
            </span>
          ))}
        </div>
      </div>
      {rooms.map((room) => {
        const blocks = data.bookings.filter((b) => b.tableNumber === room)
        return (
          <div key={room} className="ah-tt-row" role="row">
            <span className="ah-tt-label">房 {room}</span>
            <div className="ah-tt-track">
              {hours.map((m) => (
                <i key={m} className="ah-tt-grid" style={{ left: `${((m - startMin) / span) * 100}%` }} />
              ))}
              {isToday && nowPct >= 0 && nowPct <= 100 ? (
                <i className="ah-tt-now" style={{ left: `${nowPct}%` }} aria-label={`現在 ${data.nowTime}`} />
              ) : null}
              {blocks.map((b) => {
                const start = minutesOf(b.startTime)
                const end = b.endTime ? minutesOf(b.endTime) : start + Math.round(b.durationHours * 60)
                const left = Math.max(0, ((start - startMin) / span) * 100)
                const width = Math.max(2, ((Math.min(end, endMin) - Math.max(start, startMin)) / span) * 100)
                const tone = INACTIVE.has(b.status) ? 'off' : b.status === 'confirmed' ? 'ok' : 'wait'
                return (
                  <Link
                    key={b.id}
                    href={`/admin/bookings/${b.id}`}
                    className={`ah-tt-block ${tone}`}
                    style={{ left: `${left}%`, width: `${width}%` }}
                    title={`${b.startTime ?? ''}–${b.endTime ?? ''} ${b.userName ?? ''}`}
                  >
                    <b>{(b.startTime ?? '').slice(0, 5)}–{(b.endTime ?? '').slice(0, 5)}</b>
                    <span>{b.userName ?? formatPhone(b.userPhone) ?? b.humanCode ?? '—'}</span>
                  </Link>
                )
              })}
              {blocks.length === 0 ? <span className="ah-tt-empty">當日沒有預約</span> : null}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function AdminHome({ data, adminName }: Props) {
  const router = useRouter()
  const goDate = (iso: string) => router.push(iso === data.todayDate ? '/admin' : `/admin?date=${iso}`)
  const attentionTotal =
    data.attention.paymentReview + data.attention.paymentFailed + data.attention.unpaidToday

  return (
    <>
      <AdminPageHead
        sub={`${greeting(data.nowTime)}${adminName ? `，${adminName}` : ''}　${dateLabel(data.todayDate)} ${data.nowTime}`}
      />

      {data.error ? (
        <div className="admin-card" role="alert" style={{ borderColor: 'var(--admin-status-danger)' }}>
          部分資料載入失敗，下列數字未必準確：{data.error}
        </div>
      ) : null}

      {attentionTotal > 0 ? (
        <section className="admin-card ah-attention" aria-label="需要留意">
          <AlertTriangle size={20} aria-hidden style={{ color: 'var(--admin-status-warning)' }} />
          <div className="ah-attention-items">
            {data.attention.paymentReview > 0 ? (
              <Link href="/admin/payment-log">{data.attention.paymentReview} 張預約付款待審核</Link>
            ) : null}
            {data.attention.paymentFailed > 0 ? (
              <Link href="/admin/payment-log">{data.attention.paymentFailed} 張預約付款失敗（近 48 小時）</Link>
            ) : null}
            {data.attention.unpaidToday > 0 ? (
              <Link href="/admin/today">今日有 {data.attention.unpaidToday} 張預約待付款</Link>
            ) : null}
          </div>
        </section>
      ) : (
        <section className="admin-card ah-attention ok" aria-label="需要留意">
          <span className="admin-badge good">一切正常</span>
          <span className="admin-sub">暫時沒有需要處理的付款或預約</span>
        </section>
      )}

      <section className="ah-kpis" aria-label="今日與本週">
        <div className="admin-card ah-kpi hero">
          <span className="admin-sub">今日收入</span>
          <b className="ah-num">{money(data.kpi.revenueToday)}</b>
          <span className="admin-sub">已確認預約的實收金額</span>
        </div>
        <div className="admin-card ah-kpi">
          <span className="admin-sub">今日預約</span>
          <b className="ah-num">{data.kpi.bookingsToday}</b>
          <span className="admin-sub">尚有 {data.kpi.upcomingToday} 張未開始</span>
        </div>
        <div className="admin-card ah-kpi wide">
          <span className="admin-sub">近 7 日收入</span>
          <b className="ah-num">{money(data.kpi.revenueWeek)}</b>
          <Sparkline values={data.weekDaily.map((d) => d.revenue)} />
          <span className="admin-sub">共 {data.kpi.bookingsWeek} 張已確認預約</span>
        </div>
      </section>

      <section className="admin-card flat" aria-label="房間時間表">
        <div className="admin-head">
          <h3>
            <CalendarClock size={16} aria-hidden style={{ display: 'inline', marginRight: 6, verticalAlign: '-2px' }} />
            房間時間表　{dateLabel(data.date)}
          </h3>
          <div className="admin-row">
            <button type="button" className="admin-pill-btn" onClick={() => goDate(shiftDate(data.date, -1))} aria-label="前一日">
              <ChevronLeft size={18} aria-hidden />
            </button>
            <button type="button" className="admin-pill-btn" onClick={() => goDate(data.todayDate)} disabled={data.date === data.todayDate}>
              今日
            </button>
            <button type="button" className="admin-pill-btn" onClick={() => goDate(shiftDate(data.date, 1))} aria-label="後一日">
              <ChevronRight size={18} aria-hidden />
            </button>
          </div>
        </div>
        <div className="ah-tt-wrap">
          <Timetable data={data} />
        </div>
        <div className="ah-legend">
          <span><i className="ok" />已確認</span>
          <span><i className="wait" />待付款</span>
          <span><i className="off" />已取消／失效</span>
        </div>
      </section>

      <section className="admin-card flat" aria-label="最近預約">
        <div className="admin-head">
          <h3>
            <Wallet size={16} aria-hidden style={{ display: 'inline', marginRight: 6, verticalAlign: '-2px' }} />
            最近預約
          </h3>
          <Link href="/admin/bookings" className="admin-pill-btn">查看全部</Link>
        </div>
        {data.recent.length === 0 ? (
          <div className="admin-empty">暫時沒有預約記錄</div>
        ) : (
          <ul className="ah-recent">
            {data.recent.map((r) => (
              <li key={r.id}>
                <Link href={`/admin/bookings/${r.id}`}>
                  <span className="ic" aria-hidden>{(r.userName ?? '?').slice(0, 1).toUpperCase()}</span>
                  <span className="who">
                    <b>{r.userName ?? '未登記姓名'}</b>
                    <small className="admin-mono">{r.humanCode ?? '—'}</small>
                  </span>
                  <span className="when">
                    {dateLabel(r.date)} {(r.startTime ?? '').slice(0, 5)}　房 {r.tableNumber || '—'}
                  </span>
                  <span className="amt admin-num">{money(r.price)}</span>
                  <AdminStatusBadge status={r.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
