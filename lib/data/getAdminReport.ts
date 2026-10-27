import { getServiceSupabase } from '@/lib/supabase/service'
import { getAdminRevenue } from '@/lib/data/getAdminRevenue'
import { getAdminHome } from '@/lib/data/getAdminHome'
import type { RevenueBucket, RevenueTotals } from '@/lib/admin/revenue-definitions'
import { str, type Row } from '@/lib/data/adminReadHelpers'
import { bookingEndMinutes, hkNow, minutesOf, shiftDate, type AdminTodayBooking } from '@/lib/admin/today'

// Server-only loader for 每日報告 (/admin/report). One HK calendar day.
// Money comes from getAdminRevenue (same rules as 收入 and the Excel export);
// bookings come from getAdminHome so the report and the Home timetable agree.
// Test bookings and hidden users are excluded throughout.

const INACTIVE = new Set(['cancelled', 'admin_cancelled', 'expired', 'refunded', 'payment_failed'])

export type AdminReportHour = { hour: number; roomsBusy: number }

export type AdminReportData = {
  date: string
  todayDate: string
  tableCount: number
  openHour: number
  closeHour: number
  totals: RevenueTotals
  /** Same weekday one week earlier, for comparison. */
  lastWeek: { date: string; revenue: number; count: number }
  byMethod: RevenueBucket[]
  byTable: RevenueBucket[]
  promos: { code: string; uses: number; totalDiscount: number }[]
  bookings: AdminTodayBooking[]
  activeCount: number
  cancelledCount: number
  /** Booked minutes ÷ (rooms × opening minutes), 0–100. */
  occupancyPct: number
  bookedHours: number
  hours: AdminReportHour[]
  newMembers: number
  attempts: { succeeded: number; failed: number; expired: number; other: number }
  error: string | null
}

function isIsoDate(value: string | undefined): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

export async function getAdminReport(options?: { date?: string }): Promise<AdminReportData> {
  const today = hkNow().date
  const date = isIsoDate(options?.date) ? options.date : today
  const failures: string[] = []
  const service = getServiceSupabase()

  const lastWeekDate = shiftDate(date, -7)
  const [day, week, home] = await Promise.all([
    getAdminRevenue({ from: date, to: date }),
    getAdminRevenue({ from: lastWeekDate, to: lastWeekDate }),
    getAdminHome({ date }),
  ])
  if (day.error) failures.push(day.error)
  if (home.error) failures.push(home.error)

  const bookings = [...home.bookings].sort((a, b) => minutesOf(a.startTime) - minutesOf(b.startTime))
  const active = bookings.filter((b) => !INACTIVE.has(b.status) && b.status !== 'pending')

  // Occupancy and hour-by-hour busy rooms (confirmed / in-progress only).
  const openMin = Math.max(0, Math.floor(home.openHour)) * 60
  const closeMin = Math.min(24 * 60, Math.max(openMin + 60, Math.floor(home.closeHour) * 60))
  let bookedMinutes = 0
  for (const b of active) {
    const start = Math.max(openMin, minutesOf(b.startTime))
    const end = Math.min(closeMin, bookingEndMinutes(b))
    if (end > start) bookedMinutes += end - start
  }
  const capacity = home.tableCount * (closeMin - openMin)
  const hours: AdminReportHour[] = []
  for (let m = openMin; m < closeMin; m += 60) {
    const busy = new Set<number>()
    for (const b of active) {
      const s = minutesOf(b.startTime)
      const e = bookingEndMinutes(b)
      if (s < m + 60 && e > m) busy.add(b.tableNumber)
    }
    hours.push({ hour: Math.floor(m / 60), roomsBusy: busy.size })
  }

  // New members created on this HK day.
  let newMembers = 0
  const dayStart = new Date(`${date}T00:00:00+08:00`).toISOString()
  const dayEnd = new Date(`${shiftDate(date, 1)}T00:00:00+08:00`).toISOString()
  try {
    const { count, error } = await service
      .from('users')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', dayStart)
      .lt('created_at', dayEnd)
    if (error) throw error
    newMembers = count ?? 0
  } catch (err) {
    failures.push('新會員數量載入失敗')
    console.error('[admin/report] new members failed', err)
  }

  // Payment attempts started on this HK day.
  const attempts = { succeeded: 0, failed: 0, expired: 0, other: 0 }
  try {
    const { data, error } = await service
      .from('payment_attempts')
      .select('status')
      .gte('created_at', dayStart)
      .lt('created_at', dayEnd)
    if (error) throw error
    for (const row of (data ?? []) as unknown as Row[]) {
      const s = str(row, ['status'])
      if (s === 'succeeded') attempts.succeeded += 1
      else if (s === 'failed') attempts.failed += 1
      else if (s === 'expired' || s === 'cancelled') attempts.expired += 1
      else attempts.other += 1
    }
  } catch (err) {
    failures.push('付款嘗試載入失敗')
    console.error('[admin/report] attempts failed', err)
  }

  return {
    date,
    todayDate: today,
    tableCount: home.tableCount,
    openHour: home.openHour,
    closeHour: home.closeHour,
    totals: day.totals,
    lastWeek: { date: lastWeekDate, revenue: week.totals.revenue, count: week.totals.bookingCount },
    byMethod: day.byMethod,
    byTable: day.byTable,
    promos: day.promos,
    bookings,
    activeCount: active.length,
    cancelledCount: bookings.filter((b) => INACTIVE.has(b.status)).length,
    occupancyPct: capacity > 0 ? Math.round((bookedMinutes / capacity) * 100) : 0,
    bookedHours: Math.round((bookedMinutes / 60) * 10) / 10,
    hours,
    newMembers,
    attempts,
    error: failures.length > 0 ? failures.join('；') : null,
  }
}
