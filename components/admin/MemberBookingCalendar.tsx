'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { tokens } from '@/app/styles/tokens'

export type MemberBookingDay = { date: string; status: string }

function monthLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function statusColor(status: string): string {
  if (status === 'admin_cancelled' || status === 'refunded') return tokens.colors.textFaint
  if (status === 'confirmed') return tokens.colors.brand
  return tokens.colors.textMuted
}

// Quick-scan month grid of a single member's booking dates — deliberately not
// the full occupancy SlotCalendar (that fetches per-table density across all
// members); here every booking is already loaded server-side, so this just
// buckets the dates already in hand, no extra fetch.
export default function MemberBookingCalendar({ bookings }: { bookings: MemberBookingDay[] }) {
  const byMonth = useMemo(() => {
    const map = new Map<string, MemberBookingDay[]>()
    for (const b of bookings) {
      const key = b.date.slice(0, 7)
      const list = map.get(key) ?? []
      list.push(b)
      map.set(key, list)
    }
    return map
  }, [bookings])

  const months = useMemo(() => [...byMonth.keys()].sort().reverse(), [byMonth])
  const [monthIdx, setMonthIdx] = useState(0)

  if (months.length === 0) {
    return <div style={{ color: tokens.colors.textMuted, fontSize: 14 }}>No bookings yet.</div>
  }

  const key = months[monthIdx]
  const [year, month] = key.split('-').map(Number)
  const daysThisMonth = byMonth.get(key) ?? []
  const byDate = new Map(daysThisMonth.map((d) => [Number(d.date.slice(-2)), d]))

  const firstOfMonth = new Date(year, month - 1, 1)
  const startWeekday = firstOfMonth.getDay()
  const daysInMonth = new Date(year, month, 0).getDate()
  const cells: (number | null)[] = [...Array(startWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: tokens.spacing.md }}>
        <Button variant="secondary" size="sm" onClick={() => setMonthIdx((i) => Math.min(i + 1, months.length - 1))} disabled={monthIdx >= months.length - 1}>
          Previous
        </Button>
        <div style={{ color: tokens.colors.text, fontSize: 14, fontWeight: 700 }}>{monthLabel(year, month)}</div>
        <Button variant="secondary" size="sm" onClick={() => setMonthIdx((i) => Math.max(i - 1, 0))} disabled={monthIdx <= 0}>
          Next
        </Button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: tokens.spacing.xs }}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d} style={{ textAlign: 'center', fontSize: 11, color: tokens.colors.textMuted, paddingBottom: 4 }}>
            {d}
          </div>
        ))}
        {cells.map((day, i) => {
          if (day == null) return <div key={`empty-${i}`} />
          const booking = byDate.get(day)
          return (
            <div
              key={day}
              style={{
                aspectRatio: '1',
                border: `1px solid ${tokens.colors.border}`,
                borderRadius: tokens.radius.input,
                backgroundColor: booking ? `${statusColor(booking.status)}22` : 'transparent',
                color: tokens.colors.text,
                fontSize: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title={booking ? booking.status : undefined}
            >
              {day}
            </div>
          )
        })}
      </div>
    </div>
  )
}
