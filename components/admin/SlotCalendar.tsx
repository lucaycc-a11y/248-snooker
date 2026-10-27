'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, ArrowLeft } from 'lucide-react'
import { Sheet } from '@/components/ui/sheet'
import type { DayDensity, CalendarBooking } from '@/lib/data/getAdminCalendar'

type MonthResponse = { days: DayDensity[] }
type DayResponse = { bookings: CalendarBooking[]; error?: string }

const TOTAL_TABLES = 2
const OPEN_HOUR = 6
const CLOSE_HOUR = 24
const HOUR_PX = 52
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

const STATUS_LABEL: Record<string, string> = {
  confirmed: '已確認',
  pending: '待付款',
  payment_review: '付款待核實',
  cancelled: '已取消',
  admin_cancelled: '後台已取消',
  expired: '已逾時',
  refunded: '已退款',
}

function statusTone(status: string): 'ok' | 'wait' | 'off' {
  if (status === 'confirmed') return 'ok'
  if (status === 'pending' || status === 'payment_review') return 'wait'
  return 'off'
}

function load(utilization: number): 'low' | 'mid' | 'high' {
  if (utilization > 0.7) return 'high'
  if (utilization >= 0.3) return 'mid'
  return 'low'
}

function hourOffset(time: string): number {
  const [h, m] = time.split(':').map(Number)
  let hour = h + (m ?? 0) / 60
  if (hour < OPEN_HOUR) hour += 24 // wrapped past midnight
  return hour - OPEN_HOUR
}

function hhmm(t: string | null): string {
  return (t ?? '').slice(0, 5)
}

function dayLabel(date: string): string {
  const d = new Date(`${date}T00:00:00+08:00`)
  return `${Number(date.slice(5, 7))}月${Number(date.slice(8, 10))}日（${WEEKDAYS[d.getDay()]}）`
}

function hkToday(): string {
  return new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10)
}

export default function SlotCalendar({ initialYear, initialMonth, initialDays }: {
  initialYear: number
  initialMonth: number
  initialDays: DayDensity[]
}) {
  const [year, setYear] = useState(initialYear)
  const [month, setMonth] = useState(initialMonth)
  const [days, setDays] = useState(initialDays)
  const [loadingMonth, setLoadingMonth] = useState(false)
  const [monthError, setMonthError] = useState<string | null>(null)
  // Set after mount so server and browser markup always match.
  const [today, setToday] = useState<string | null>(null)

  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [dayBookings, setDayBookings] = useState<CalendarBooking[]>([])
  const [loadingDay, setLoadingDay] = useState(false)
  const [dayError, setDayError] = useState<string | null>(null)
  const [popupBooking, setPopupBooking] = useState<CalendarBooking | null>(null)

  useEffect(() => setToday(hkToday()), [])

  const fetchMonth = useCallback((y: number, m: number) => {
    setLoadingMonth(true)
    setMonthError(null)
    fetch(`/api/admin/calendar?view=month&year=${y}&month=${m}`)
      .then(async (res) => {
        const json = (await res.json()) as MonthResponse
        if (!res.ok || !Array.isArray(json.days)) throw new Error('日曆資料載入失敗')
        setDays(json.days)
      })
      .catch((e: unknown) => setMonthError(e instanceof Error ? e.message : '日曆資料載入失敗'))
      .finally(() => setLoadingMonth(false))
  }, [])

  useEffect(() => {
    if (year === initialYear && month === initialMonth) return
    fetchMonth(year, month)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month])

  function openDay(date: string) {
    setSelectedDate(date)
    setLoadingDay(true)
    setDayError(null)
    fetch(`/api/admin/calendar?view=day&date=${date}`)
      .then(async (res) => {
        const json = (await res.json()) as DayResponse
        if (!res.ok || json.error) {
          setDayError(json.error ?? '日曆資料載入失敗')
          setDayBookings([])
          return
        }
        setDayBookings(json.bookings)
      })
      .catch((e: unknown) => {
        setDayError(e instanceof Error ? e.message : '日曆資料載入失敗')
        setDayBookings([])
      })
      .finally(() => setLoadingDay(false))
  }

  function goToMonth(delta: number) {
    const d = new Date(year, month - 1 + delta, 1)
    setYear(d.getFullYear())
    setMonth(d.getMonth() + 1)
  }

  // ── Day view ────────────────────────────────────────────────────────────
  if (selectedDate) {
    const hours = Array.from({ length: CLOSE_HOUR - OPEN_HOUR }, (_, i) => OPEN_HOUR + i)
    const live = dayBookings.filter((b) => statusTone(b.status) !== 'off').length
    return (
      <section className="admin-card cal-card">
        <div className="cal-head">
          <button type="button" className="admin-pill-btn sm" onClick={() => setSelectedDate(null)}>
            <ArrowLeft size={16} aria-hidden /> 返回月曆
          </button>
          <div className="cal-title">
            <b>{dayLabel(selectedDate)}</b>
            {!loadingDay && !dayError ? <small>{live} 張有效預約</small> : null}
          </div>
          <span className="cal-head-spacer" aria-hidden />
        </div>

        {dayError ? (
          <div role="alert" data-cms-key="admin.calendar.day_error" className="bug-error">
            {dayError}
          </div>
        ) : loadingDay ? (
          <div className="admin-empty">載入中…</div>
        ) : (
          <div className="cal-day" style={{ ['--hour-px' as string]: `${HOUR_PX}px` }}>
            <div className="cal-hours" aria-hidden>
              <div className="cal-col-head" />
              <div className="cal-hours-body" style={{ height: hours.length * HOUR_PX }}>
                {hours.map((h) => (
                  <span key={h} style={{ top: (h - OPEN_HOUR) * HOUR_PX }}>
                    {String(h % 24).padStart(2, '0')}:00
                  </span>
                ))}
              </div>
            </div>
            {Array.from({ length: TOTAL_TABLES }, (_, i) => i + 1).map((t) => (
              <div key={t} className="cal-col">
                <div className="cal-col-head">房 {t}</div>
                <div className="cal-col-body" style={{ height: hours.length * HOUR_PX }}>
                  {hours.map((h) => (
                    <i key={h} className="cal-line" style={{ top: (h - OPEN_HOUR) * HOUR_PX }} />
                  ))}
                  {dayBookings
                    .filter((b) => b.tableNumber === t && b.startTime)
                    .map((b) => {
                      const start = hourOffset(b.startTime ?? '00:00')
                      const end = b.endTime ? hourOffset(b.endTime) : start + 1
                      const span = Math.max(0.5, end - start)
                      const tone = statusTone(b.status)
                      return (
                        <button
                          key={b.id}
                          type="button"
                          className={`cal-block ${tone}${span < 0.75 ? ' short' : ''}`}
                          style={{ top: start * HOUR_PX + 2, height: span * HOUR_PX - 4 }}
                          onClick={() => setPopupBooking(b)}
                        >
                          <b>{b.userName ?? b.userEmail ?? b.bookingReference ?? '預約'}</b>
                          <span>
                            {hhmm(b.startTime)}–{hhmm(b.endTime)}
                          </span>
                        </button>
                      )
                    })}
                </div>
              </div>
            ))}
          </div>
        )}

        <Sheet open={!!popupBooking} onClose={() => setPopupBooking(null)}>
          {popupBooking ? (
            <div className="cal-pop">
              <p className="admin-mono cal-pop-code">{popupBooking.bookingReference ?? popupBooking.id.slice(0, 8)}</p>
              <dl>
                <div><dt>客人</dt><dd>{popupBooking.userName ?? popupBooking.userEmail ?? '訪客'}</dd></div>
                <div><dt>房間</dt><dd>房 {popupBooking.tableNumber}</dd></div>
                <div><dt>時間</dt><dd>{hhmm(popupBooking.startTime)} – {hhmm(popupBooking.endTime)}</dd></div>
                <div>
                  <dt>狀態</dt>
                  <dd>
                    <span className={`admin-tag${statusTone(popupBooking.status) === 'ok' ? '' : statusTone(popupBooking.status) === 'wait' ? ' warn' : ' bad'}`}>
                      {STATUS_LABEL[popupBooking.status] ?? popupBooking.status}
                    </span>
                  </dd>
                </div>
              </dl>
              <Link href={`/admin/bookings/${popupBooking.id}`} className="admin-pill-btn primary">
                開啟預約詳情
              </Link>
            </div>
          ) : null}
        </Sheet>
      </section>
    )
  }

  // ── Month view ──────────────────────────────────────────────────────────
  const startWeekday = new Date(year, month - 1, 1).getDay()
  const cells: (DayDensity | null)[] = [...Array(startWeekday).fill(null), ...days]
  const total = days.reduce((sum, d) => sum + d.bookingsCount, 0)

  return (
    <section className="admin-card cal-card">
      <div className="cal-head">
        <button type="button" className="ad-icon-btn" onClick={() => goToMonth(-1)} aria-label="上個月">
          <ChevronLeft size={18} aria-hidden />
        </button>
        <div className="cal-title">
          <b>{year} 年 {month} 月</b>
          <small>本月共 {total} 張預約</small>
        </div>
        <button type="button" className="ad-icon-btn" onClick={() => goToMonth(1)} aria-label="下個月">
          <ChevronRight size={18} aria-hidden />
        </button>
      </div>

      {monthError ? <div role="alert" className="bug-error">{monthError}</div> : null}

      <div className="cal-month" aria-busy={loadingMonth}>
        {WEEKDAYS.map((d) => (
          <div key={d} className="cal-wd">
            {d}
          </div>
        ))}
        {cells.map((day, i) =>
          day ? (
            <button
              key={day.date}
              type="button"
              className={`cal-day-cell${day.bookingsCount > 0 ? ` has ${load(day.utilization)}` : ''}${day.date === today ? ' today' : ''}`}
              onClick={() => openDay(day.date)}
              aria-label={`${dayLabel(day.date)}，${day.bookingsCount} 張預約`}
            >
              <span className="cal-num">{Number(day.date.slice(-2))}</span>
              {day.bookingsCount > 0 ? (
                <>
                  <span className="cal-count">{day.bookingsCount} 張</span>
                  <span className="cal-bar" style={{ width: `${Math.min(100, Math.max(8, Math.round(day.utilization * 100)))}%` }} />
                </>
              ) : null}
            </button>
          ) : (
            <div key={`empty-${i}`} />
          ),
        )}
      </div>
      <p className="cal-legend">
        <i className="low" /> 空閒 <i className="mid" /> 一般 <i className="high" /> 繁忙（按房間使用時間計算）
      </p>
    </section>
  )
}
