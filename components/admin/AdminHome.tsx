'use client'

/**
 * AdminHome — the /admin landing page, built around today's work.
 *
 *   1. Four stat cards (today's revenue, today's bookings, in progress now,
 *      items to handle), each with an arrow link to the page that acts on it.
 *   2. Room timetable for the chosen day + a 「下一場 / 進行中」 card with the
 *      actions staff need at the door: open booking, WhatsApp, call.
 *   3. Today's agenda (every booking with quick actions), a 7-day revenue
 *      bar chart, and the latest bookings.
 *
 * All figures come from getAdminHome, which excludes test bookings and hidden
 * users. Icons are SVG (lucide) only.
 */

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  MessageCircle,
  Phone,
  Plus,
} from 'lucide-react'
import type { AdminHomeData } from '@/lib/data/getAdminHome'
import type { AdminTodayBooking } from '@/lib/admin/today'
import { bookingEndMinutes, dateLabel, minutesOf, money, shiftDate, statusOf } from '@/lib/admin/today'
import AdminStatusBadge from './AdminStatusBadge'
import AdminPageHead from './AdminPageHead'

type Props = {
  data: AdminHomeData
  adminName: string | null
}

const INACTIVE = new Set(['cancelled', 'admin_cancelled', 'expired', 'refunded', 'payment_failed'])
const WEEKDAY = ['日', '一', '二', '三', '四', '五', '六']

function greeting(nowTime: string): string {
  const hour = Number(nowTime.split(':')[0])
  if (hour < 6) return '夜深了'
  if (hour < 12) return '早晨'
  if (hour < 18) return '午安'
  return '晚上好'
}

function hhmm(value: string | null): string {
  return (value ?? '').slice(0, 5) || '—'
}

function localDigits(raw: string | null): string | null {
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  const local = digits.startsWith('852') && digits.length === 11 ? digits.slice(3) : digits
  return local.length >= 8 ? local : null
}

function phoneLabel(raw: string | null): string {
  const local = localDigits(raw)
  if (!local) return ''
  return local.length === 8 ? `${local.slice(0, 4)} ${local.slice(4)}` : local
}

function waHref(raw: string | null): string | null {
  const local = localDigits(raw)
  if (!local) return null
  return `https://wa.me/${local.length === 8 ? `852${local}` : local}`
}

function telHref(raw: string | null): string | null {
  const local = localDigits(raw)
  return local ? `tel:${local.length === 8 ? `+852${local}` : `+${local}`}` : null
}

function endMinutes(b: AdminTodayBooking): number {
  return bookingEndMinutes(b)
}

function shortDate(iso: string | null): string {
  if (!iso) return '—'
  const [, m, d] = iso.split('-')
  return m && d ? `${Number(m)}/${Number(d)}` : iso
}

function initialOf(name: string | null): string {
  return (name?.trim() || '?').slice(0, 1).toUpperCase()
}

function weekdayOf(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  return Number.isNaN(d.getTime()) ? '' : WEEKDAY[d.getUTCDay()]
}

/* ── Pieces ──────────────────────────────────────────────────────────── */

function StatCard({
  label,
  value,
  foot,
  href,
  hero = false,
  tone,
}: {
  label: string
  value: React.ReactNode
  foot: React.ReactNode
  href: string
  hero?: boolean
  tone?: 'warn'
}) {
  return (
    <Link href={href} className={`admin-card ah-stat${hero ? ' hero' : ''}${tone ? ` ${tone}` : ''}`}>
      <span className="ah-stat-top">
        <span className="ah-stat-label">{label}</span>
        <span className="ah-arrow" aria-hidden>
          <ArrowUpRight size={18} strokeWidth={1.8} />
        </span>
      </span>
      <b className="ah-stat-num">{value}</b>
      <span className="ah-stat-foot">{foot}</span>
    </Link>
  )
}

function ContactButtons({ phone, compact = false }: { phone: string | null; compact?: boolean }) {
  const wa = waHref(phone)
  const tel = telHref(phone)
  if (!wa && !tel) return null
  return (
    <>
      {wa ? (
        <a href={wa} target="_blank" rel="noreferrer" className={compact ? 'ah-ic-btn' : 'admin-pill-btn'} aria-label="WhatsApp">
          <MessageCircle size={compact ? 16 : 18} aria-hidden />
          {compact ? null : 'WhatsApp'}
        </a>
      ) : null}
      {tel ? (
        <a href={tel} className={compact ? 'ah-ic-btn' : 'admin-pill-btn'} aria-label={`致電 ${phoneLabel(phone)}`}>
          <Phone size={compact ? 16 : 18} aria-hidden />
          {compact ? null : '致電'}
        </a>
      ) : null}
    </>
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
                const end = endMinutes(b)
                const left = Math.max(0, ((start - startMin) / span) * 100)
                const width = Math.max(3, ((Math.min(end, endMin) - Math.max(start, startMin)) / span) * 100)
                const tone = INACTIVE.has(b.status) ? 'off' : b.status === 'confirmed' ? 'ok' : 'wait'
                return (
                  <Link
                    key={b.id}
                    href={`/admin/bookings/${b.id}`}
                    className={`ah-tt-block ${tone}${width < 9 ? ' narrow' : ''}`}
                    style={{ left: `${left}%`, width: `${width}%` }}
                    title={`${hhmm(b.startTime)}–${hhmm(b.endTime)} ${b.userName ?? ''}`}
                  >
                    {width < 9 ? (
                      <b aria-hidden>{initialOf(b.userName)}</b>
                    ) : (
                      <>
                        <b>{hhmm(b.startTime)}</b>
                        <span>{b.userName ?? (phoneLabel(b.userPhone) || b.humanCode || '—')}</span>
                      </>
                    )}
                  </Link>
                )
              })}
              {blocks.length === 0 ? <span className="ah-tt-empty">沒有預約</span> : null}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function WeekBars({ data }: { data: AdminHomeData }) {
  const max = Math.max(...data.weekDaily.map((d) => d.revenue), 1)
  const best = data.weekDaily.reduce((a, d) => (d.revenue > a ? d.revenue : a), 0)
  return (
    <div className="ah-bars" role="img" aria-label="近 7 日每日收入">
      {data.weekDaily.map((d) => {
        const pct = d.revenue > 0 ? Math.max(14, (d.revenue / max) * 100) : 0
        const cls = d.revenue === 0 ? 'zero' : d.date === data.todayDate ? 'today' : d.revenue === best ? 'best' : ''
        return (
          <div key={d.date} className="ah-bar-col" title={`${dateLabel(d.date)} ${money(d.revenue)}`}>
            <div className="ah-bar-slot">
              {d.revenue === best && best > 0 ? <span className="ah-bar-tip">{money(d.revenue)}</span> : null}
              <span className={`ah-bar ${cls}`} style={{ height: `${pct}%` }} />
            </div>
            <small>{weekdayOf(d.date)}</small>
          </div>
        )
      })}
    </div>
  )
}

/* ── Page ────────────────────────────────────────────────────────────── */

export default function AdminHome({ data, adminName }: Props) {
  const router = useRouter()
  const goDate = (iso: string) => router.push(iso === data.todayDate ? '/admin' : `/admin?date=${iso}`)
  const { attention } = data
  const attentionTotal = attention.paymentReview + attention.paymentFailed + attention.unpaidToday

  const isToday = data.date === data.todayDate
  const active = data.bookings
    .filter((b) => !INACTIVE.has(b.status))
    .sort((a, b) => minutesOf(a.startTime) - minutesOf(b.startTime))
  const live = isToday
    ? active.filter((b) => minutesOf(b.startTime) <= data.nowMinutes && endMinutes(b) > data.nowMinutes)
    : []
  const upcoming = isToday ? active.filter((b) => minutesOf(b.startTime) > data.nowMinutes) : active
  const focus = live[0] ?? upcoming[0] ?? null
  const focusIsLive = Boolean(focus && live.includes(focus))
  const minsUntil = focus && !focusIsLive && isToday ? minutesOf(focus.startTime) - data.nowMinutes : null

  return (
    <>
      <AdminPageHead
        sub={`${greeting(data.nowTime)}${adminName ? `，${adminName}` : ''} · ${dateLabel(data.todayDate)} ${data.nowTime}`}
        actions={
          <>
            <Link href="/admin/today" className="admin-pill-btn">
              <CalendarClock size={18} aria-hidden />
              今日預約
            </Link>
            <Link href="/admin/bookings?new=1" className="admin-pill-btn primary">
              <Plus size={18} aria-hidden />
              新增預約
            </Link>
          </>
        }
      />

      {data.error ? (
        <div className="admin-card ah-alert bad" role="alert">
          <AlertTriangle size={18} aria-hidden />
          <span>部分資料載入失敗，下列數字未必準確：{data.error}</span>
        </div>
      ) : null}

      {attentionTotal > 0 ? (
        <section className="admin-card ah-alert" aria-label="需要處理">
          <AlertTriangle size={18} aria-hidden />
          <div className="ah-alert-items">
            {attention.paymentReview > 0 ? (
              <Link href="/admin/payment-log">{attention.paymentReview} 張付款待審核</Link>
            ) : null}
            {attention.paymentFailed > 0 ? (
              <Link href="/admin/payment-log">{attention.paymentFailed} 張付款失敗（近 48 小時）</Link>
            ) : null}
            {attention.unpaidToday > 0 ? (
              <Link href="/admin/today">今日 {attention.unpaidToday} 張預約待付款</Link>
            ) : null}
          </div>
        </section>
      ) : null}

      <div className="ah-grid">
        {/* Row 1 — stats */}
        <StatCard
          hero
          label="今日收入"
          value={money(data.kpi.revenueToday)}
          foot="已確認預約的實收金額"
          href="/admin/revenue"
        />
        <StatCard
          label="今日預約"
          value={data.kpi.bookingsToday}
          foot={<><span className="admin-badge good">{data.kpi.upcomingToday} 張</span>尚未開始</>}
          href="/admin/today"
        />
        <StatCard
          label="正在進行"
          value={live.length}
          foot={
            live.length > 0
              ? live.map((b) => `房 ${b.tableNumber} 至 ${hhmm(b.endTime)}`).join('，')
              : upcoming[0] && isToday
                ? `下一場 ${hhmm(upcoming[0].startTime)}・房 ${upcoming[0].tableNumber}`
                : '暫時沒有客人'
          }
          href="/admin/today"
        />
        <StatCard
          label="待處理"
          value={attentionTotal}
          tone={attentionTotal > 0 ? 'warn' : undefined}
          foot={attentionTotal > 0 ? '付款審核、失敗或未付款' : <><span className="admin-badge good">一切正常</span></>}
          href="/admin/payment-log"
        />

        {/* Row 2 — timetable + next */}
        <section className="admin-card ah-card s3" aria-label="房間時間表">
          <div className="ah-card-head">
            <h3>房間時間表</h3>
            <div className="ah-date-nav">
              <button type="button" className="ah-ic-btn" onClick={() => goDate(shiftDate(data.date, -1))} aria-label="前一日">
                <ChevronLeft size={18} aria-hidden />
              </button>
              <button
                type="button"
                className={`admin-pill-btn sm${isToday ? ' primary' : ''}`}
                onClick={() => goDate(data.todayDate)}
              >
                {isToday ? `今日 · ${dateLabel(data.date)}` : dateLabel(data.date)}
              </button>
              <button type="button" className="ah-ic-btn" onClick={() => goDate(shiftDate(data.date, 1))} aria-label="後一日">
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
            {isToday ? <span><i className="now" />現在 {data.nowTime}</span> : null}
          </div>
        </section>

        <section className="admin-card ah-card ah-next" aria-label={focusIsLive ? '進行中' : '下一場'}>
          <div className="ah-card-head">
            <h3>{focusIsLive ? '進行中' : isToday ? '下一場' : '當日第一場'}</h3>
            {focus ? <AdminStatusBadge status={focus.status} /> : null}
          </div>
          {focus ? (
            <div className="ah-next-body">
              <p className="ah-next-name">{focus.userName ?? (phoneLabel(focus.userPhone) || '未登記姓名')}</p>
              <p className="ah-next-meta">
                <Clock size={15} aria-hidden />
                {hhmm(focus.startTime)} – {hhmm(focus.endTime)} · 房 {focus.tableNumber}
              </p>
              {minsUntil !== null ? (
                <p className="ah-next-count">
                  {minsUntil < 60 ? `${minsUntil} 分鐘後開始` : `${Math.floor(minsUntil / 60)} 小時 ${minsUntil % 60} 分鐘後開始`}
                </p>
              ) : focusIsLive ? (
                <p className="ah-next-count live">
                  尚餘 {Math.max(0, endMinutes(focus) - data.nowMinutes)} 分鐘
                </p>
              ) : null}
              <p className="ah-next-code admin-mono">{focus.humanCode ?? ''}{focus.userPhone ? ` · ${phoneLabel(focus.userPhone)}` : ''}</p>
              <div className="ah-next-actions">
                <Link href={`/admin/bookings/${focus.id}`} className="admin-pill-btn primary">
                  <ExternalLink size={18} aria-hidden />
                  查看預約
                </Link>
                <div className="ah-next-contact">
                  <ContactButtons phone={focus.userPhone} />
                </div>
              </div>
            </div>
          ) : (
            <div className="ah-empty">
              <CalendarClock size={28} strokeWidth={1.6} aria-hidden />
              <b>{isToday ? '今日已沒有其他預約' : '當日沒有預約'}</b>
              <Link href="/admin/bookings?new=1" className="admin-pill-btn sm">
                <Plus size={16} aria-hidden />
                新增預約
              </Link>
            </div>
          )}
        </section>

        {/* Row 3 — agenda, chart, recent */}
        <section className="admin-card ah-card s2" aria-label="預約清單">
          <div className="ah-card-head">
            <h3>{isToday ? '今日預約' : `${dateLabel(data.date)} 預約`}<span className="ah-count">{data.bookings.length}</span></h3>
            <Link href="/admin/today" className="admin-pill-btn sm">查看全部</Link>
          </div>
          {data.bookings.length === 0 ? (
            <div className="ah-empty">
              <CalendarClock size={28} strokeWidth={1.6} aria-hidden />
              <b>{isToday ? '今日暫時沒有預約' : '當日沒有預約'}</b>
              <span>客人在網站預約後會即時出現在這裏</span>
            </div>
          ) : (
            <ul className="ah-rows">
              {[...data.bookings]
                .sort((a, b) => minutesOf(a.startTime) - minutesOf(b.startTime))
                .map((b) => {
                  const isLive = live.includes(b)
                  const isPast = isToday && endMinutes(b) <= data.nowMinutes
                  return (
                    <li key={b.id} className={`${isLive ? 'live' : ''}${isPast || INACTIVE.has(b.status) ? ' past' : ''}`}>
                      <span className="ah-time admin-num">
                        <b>{hhmm(b.startTime)}</b>
                        <small>{hhmm(b.endTime)}</small>
                      </span>
                      <span className="ah-av" aria-hidden>{initialOf(b.userName)}</span>
                      <Link href={`/admin/bookings/${b.id}`} className="ah-row-main">
                        <b>{b.userName ?? (phoneLabel(b.userPhone) || '未登記姓名')}</b>
                        <small>
                          房 {b.tableNumber} · {money(b.price)}
                          {b.humanCode ? <> · <span className="admin-mono">{b.humanCode}</span></> : null}
                        </small>
                      </Link>
                      {isLive ? <span className="admin-badge good">進行中</span> : <AdminStatusBadge status={b.status} />}
                      <span className="ah-row-actions">
                        <ContactButtons phone={b.userPhone} compact />
                      </span>
                    </li>
                  )
                })}
            </ul>
          )}
        </section>

        <section className="admin-card ah-card" aria-label="近 7 日收入">
          <div className="ah-card-head">
            <h3>近 7 日收入</h3>
            <Link href="/admin/revenue" className="ah-arrow" aria-label="查看收入">
              <ArrowUpRight size={18} strokeWidth={1.8} />
            </Link>
          </div>
          <p className="ah-week-total">
            <b>{money(data.kpi.revenueWeek)}</b>
            <span>{data.kpi.bookingsWeek} 張已確認預約</span>
          </p>
          <WeekBars data={data} />
        </section>

        <section className="admin-card ah-card" aria-label="最近預約">
          <div className="ah-card-head">
            <h3>最近預約</h3>
            <Link href="/admin/bookings" className="ah-arrow" aria-label="查看預約列表">
              <ArrowUpRight size={18} strokeWidth={1.8} />
            </Link>
          </div>
          {data.recent.length === 0 ? (
            <div className="ah-empty"><b>暫時沒有預約記錄</b></div>
          ) : (
            <ul className="ah-mini">
              {data.recent.slice(0, 6).map((r) => (
                <li key={r.id}>
                  <Link href={`/admin/bookings/${r.id}`}>
                    <span className="ah-av sm" aria-hidden>{initialOf(r.userName)}</span>
                    <span className="ah-mini-main">
                      <b>{r.userName ?? '未登記姓名'}</b>
                      <small>
                        {shortDate(r.date)} {hhmm(r.startTime)} ·{' '}
                        {r.status === 'confirmed' ? `房 ${r.tableNumber || '—'}` : <span className={`ah-st ${statusOf(r.status)[1]}`}>{statusOf(r.status)[0]}</span>}
                      </small>
                    </span>
                    <span className="ah-mini-amt admin-num">{money(r.price)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  )
}
