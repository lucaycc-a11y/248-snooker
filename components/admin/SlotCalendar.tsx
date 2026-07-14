'use client'

import { useEffect, useState, useCallback } from 'react'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { tokens } from '@/app/styles/tokens'
import type { DayDensity, CalendarBooking } from '@/lib/data/getAdminCalendar'

type MonthResponse = { days: DayDensity[] }
type DayResponse = { bookings: CalendarBooking[] }

const TOTAL_TABLES = 2
const OPEN_HOUR = 6
const CLOSE_HOUR = 24

function densityColor(utilization: number): string {
  if (utilization > 0.7) return tokens.colors.danger
  if (utilization >= 0.3) return '#eab308'
  return tokens.colors.brand
}

function timeToHourOffset(time: string, openHour: number): number {
  const [h, m] = time.split(':').map(Number)
  let hour = h + (m ?? 0) / 60
  if (hour < openHour) hour += 24 // wrapped past midnight
  return hour - openHour
}

function monthLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
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

  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [dayBookings, setDayBookings] = useState<CalendarBooking[]>([])
  const [loadingDay, setLoadingDay] = useState(false)
  const [popupBooking, setPopupBooking] = useState<CalendarBooking | null>(null)

  const fetchMonth = useCallback((y: number, m: number) => {
    setLoadingMonth(true)
    fetch(`/api/admin/calendar?view=month&year=${y}&month=${m}`)
      .then((res) => res.json())
      .then((json: MonthResponse) => setDays(json.days))
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
    fetch(`/api/admin/calendar?view=day&date=${date}`)
      .then((res) => res.json())
      .then((json: DayResponse) => setDayBookings(json.bookings))
      .finally(() => setLoadingDay(false))
  }

  function goToMonth(delta: number) {
    const d = new Date(year, month - 1 + delta, 1)
    setYear(d.getFullYear())
    setMonth(d.getMonth() + 1)
  }

  if (selectedDate) {
    const hours = Array.from({ length: CLOSE_HOUR - OPEN_HOUR }, (_, i) => OPEN_HOUR + i)
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: tokens.spacing.md }}>
          <Button variant="secondary" size="sm" onClick={() => setSelectedDate(null)}>
            Back to month
          </Button>
          <div style={{ color: tokens.colors.text, fontSize: 16, fontWeight: 700 }}>{selectedDate}</div>
        </div>

        {loadingDay ? (
          <div style={{ color: tokens.colors.textMuted, fontSize: 14 }}>Loading…</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: `60px repeat(${TOTAL_TABLES}, 1fr)`, border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.card, overflow: 'hidden' }}>
            <div style={{ borderBottom: `1px solid ${tokens.colors.border}` }} />
            {Array.from({ length: TOTAL_TABLES }, (_, i) => i + 1).map((t) => (
              <div
                key={t}
                style={{
                  padding: tokens.spacing.sm,
                  textAlign: 'center',
                  color: tokens.colors.text,
                  fontSize: 13,
                  fontWeight: 600,
                  borderBottom: `1px solid ${tokens.colors.border}`,
                  borderLeft: `1px solid ${tokens.colors.border}`,
                }}
              >
                Table {t}
              </div>
            ))}

            {hours.map((h) => (
              <div key={`row-${h}`} style={{ display: 'contents' }}>
                <div
                  style={{
                    padding: '4px 8px',
                    fontSize: 12,
                    color: tokens.colors.textMuted,
                    borderTop: `1px solid ${tokens.colors.border}`,
                    height: 40,
                  }}
                >
                  {String(h % 24).padStart(2, '0')}:00
                </div>
                {Array.from({ length: TOTAL_TABLES }, (_, i) => i + 1).map((t) => (
                  <div
                    key={`cell-${h}-${t}`}
                    style={{
                      borderTop: `1px solid ${tokens.colors.border}`,
                      borderLeft: `1px solid ${tokens.colors.border}`,
                      height: 40,
                      position: 'relative',
                    }}
                  >
                    {dayBookings
                      .filter((b) => b.tableNumber === t && b.startTime && Math.floor(timeToHourOffset(b.startTime, OPEN_HOUR) + OPEN_HOUR) === h)
                      .map((b) => {
                        const start = timeToHourOffset(b.startTime!, OPEN_HOUR)
                        const end = b.endTime ? timeToHourOffset(b.endTime, OPEN_HOUR) : start + 1
                        const durationHours = Math.max(0.25, end - start)
                        return (
                          <button
                            key={b.id}
                            onClick={() => setPopupBooking(b)}
                            style={{
                              position: 'absolute',
                              top: 2,
                              left: 2,
                              right: 2,
                              height: durationHours * 40 - 4,
                              backgroundColor: tokens.colors.brandDim,
                              border: `1px solid ${tokens.colors.brand}`,
                              borderRadius: 6,
                              color: tokens.colors.text,
                              fontSize: 11,
                              textAlign: 'left',
                              padding: '2px 6px',
                              cursor: 'pointer',
                              overflow: 'hidden',
                              zIndex: 1,
                            }}
                          >
                            {b.userName ?? b.userEmail ?? b.bookingReference ?? 'Booking'}
                          </button>
                        )
                      })}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        <Sheet open={!!popupBooking} onClose={() => setPopupBooking(null)}>
          {popupBooking && (
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: tokens.colors.text, marginBottom: tokens.spacing.sm }}>
                {popupBooking.bookingReference ?? popupBooking.id.slice(0, 8)}
              </div>
              <div style={{ color: tokens.colors.textMuted, fontSize: 14, marginBottom: 4 }}>
                {popupBooking.userName ?? popupBooking.userEmail ?? 'Guest'}
              </div>
              <div style={{ color: tokens.colors.textMuted, fontSize: 14, marginBottom: 4 }}>
                Table {popupBooking.tableNumber} · {popupBooking.startTime}–{popupBooking.endTime}
              </div>
              <div style={{ color: tokens.colors.textMuted, fontSize: 14 }}>Status: {popupBooking.status}</div>
            </div>
          )}
        </Sheet>
      </div>
    )
  }

  const firstOfMonth = new Date(year, month - 1, 1)
  const startWeekday = firstOfMonth.getDay()
  const cells: (DayDensity | null)[] = [...Array(startWeekday).fill(null), ...days]

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: tokens.spacing.md }}>
        <Button variant="secondary" size="sm" onClick={() => goToMonth(-1)}>
          Previous
        </Button>
        <div style={{ color: tokens.colors.text, fontSize: 16, fontWeight: 700 }}>{monthLabel(year, month)}</div>
        <Button variant="secondary" size="sm" onClick={() => goToMonth(1)}>
          Next
        </Button>
      </div>

      {loadingMonth ? (
        <div style={{ color: tokens.colors.textMuted, fontSize: 14 }}>Loading…</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: tokens.spacing.xs }}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} style={{ textAlign: 'center', fontSize: 12, color: tokens.colors.textMuted, paddingBottom: 4 }}>
              {d}
            </div>
          ))}
          {cells.map((day, i) =>
            day ? (
              <button
                key={day.date}
                onClick={() => openDay(day.date)}
                style={{
                  aspectRatio: '1',
                  border: `1px solid ${tokens.colors.border}`,
                  borderRadius: tokens.radius.input,
                  backgroundColor: day.bookingsCount > 0 ? `${densityColor(day.utilization)}22` : 'transparent',
                  color: tokens.colors.text,
                  fontSize: 13,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 2,
                }}
              >
                <span>{Number(day.date.slice(-2))}</span>
                {day.bookingsCount > 0 && (
                  <span style={{ fontSize: 10, color: densityColor(day.utilization) }}>{day.bookingsCount}</span>
                )}
              </button>
            ) : (
              <div key={`empty-${i}`} />
            )
          )}
        </div>
      )}
    </div>
  )
}
