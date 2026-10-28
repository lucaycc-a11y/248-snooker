import { getServiceSupabase } from '@/lib/supabase/service'
import { getAdminRevenue, type AdminRevenueDailyRow } from '@/lib/data/getAdminRevenue'
import { getHiddenUserList } from '@/lib/data/getHiddenUserIds'
import type { RevenueBucket, RevenueTotals } from '@/lib/admin/revenue-definitions'
import { str, type Row } from '@/lib/data/adminReadHelpers'
import { hkNow, shiftDate } from '@/lib/admin/today'

// Server-only loader for 月報 (/admin/report/monthly). One HK calendar month, compared with the
// previous month over the same number of days (so a month in progress is never judged against a
// full one). Money comes from getAdminRevenue — the same rules as 收入 and the Excel export.
// Test bookings and hidden users are excluded throughout.

export type MonthlyReportData = {
  month: string
  label: string
  from: string
  to: string
  /** The month is still running: figures cover day 1 to `to` only. */
  partial: boolean
  days: number
  prevLabel: string
  totals: RevenueTotals
  prevTotals: RevenueTotals
  daily: AdminRevenueDailyRow[]
  weekday: { label: string; revenue: number; count: number }[]
  byMethod: RevenueBucket[]
  byTable: RevenueBucket[]
  byPeriod: RevenueBucket[]
  promos: { code: string; uses: number; totalDiscount: number }[]
  bookings: { total: number; confirmed: number; cancelled: number; expired: number; refunded: number; paymentFailed: number; pending: number }
  attempts: { succeeded: number; failed: number; expired: number; other: number; successRate: number | null }
  members: { newCount: number; prevCount: number; daily: { date: string; count: number }[] }
  errors: { total: number; unresolved: number; bySource: { source: string; count: number }[] }
  error: string | null
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

export function isMonth(v: string | undefined): v is string {
  return typeof v === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(v)
}

function lastDayOf(month: string): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return `${month}-${String(d).padStart(2, '0')}`
}

export function prevMonthOf(month: string): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 2, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return `${y}年${m}月`
}

const hkStart = (date: string) => new Date(`${date}T00:00:00+08:00`).toISOString()

export async function getAdminMonthlyReport(options?: { month?: string }): Promise<MonthlyReportData> {
  const today = hkNow().date
  const month = isMonth(options?.month) ? options.month : today.slice(0, 7)
  const from = `${month}-01`
  const monthEnd = lastDayOf(month)
  const partial = month === today.slice(0, 7) && today < monthEnd
  const to = month > today.slice(0, 7) ? from : partial ? today : monthEnd
  const days = Number(to.slice(8, 10))

  const prev = prevMonthOf(month)
  const prevFrom = `${prev}-01`
  const prevEndFull = lastDayOf(prev)
  const prevTo = `${prev}-${String(Math.min(days, Number(prevEndFull.slice(8, 10)))).padStart(2, '0')}`

  const failures: string[] = []
  const service = getServiceSupabase()

  const [cur, prevRev] = await Promise.all([
    getAdminRevenue({ from, to }),
    getAdminRevenue({ from: prevFrom, to: prevTo }),
  ])
  if (cur.error) failures.push(cur.error)
  if (prevRev.error) failures.push(prevRev.error)

  // Weekday pattern from the daily series.
  const wd = WEEKDAYS.map((label) => ({ label, revenue: 0, count: 0 }))
  for (const d of cur.daily) {
    const idx = new Date(`${d.date}T00:00:00Z`).getUTCDay()
    wd[idx].revenue += d.revenue
    wd[idx].count += d.count
  }

  let hidden = new Set<string>()
  try {
    hidden = (await getHiddenUserList()).ids
  } catch (err) {
    failures.push('隱藏帳戶清單載入失敗')
    console.error('[admin/monthly] hidden list failed', err)
  }

  // Booking outcomes by status (test bookings excluded).
  const bookings = { total: 0, confirmed: 0, cancelled: 0, expired: 0, refunded: 0, paymentFailed: 0, pending: 0 }
  try {
    const { data, error } = await service.from('bookings').select('status, user_id').gte('date', from).lte('date', to).eq('is_test', false).limit(20000)
    if (error) throw error
    for (const r of (data ?? []) as unknown as Row[]) {
      if (typeof r.user_id === 'string' && hidden.has(r.user_id)) continue
      bookings.total += 1
      const s = str(r, ['status'])
      if (s === 'confirmed' || s === 'completed') bookings.confirmed += 1
      else if (s === 'cancelled' || s === 'admin_cancelled') bookings.cancelled += 1
      else if (s === 'expired') bookings.expired += 1
      else if (s === 'refunded') bookings.refunded += 1
      else if (s === 'payment_failed') bookings.paymentFailed += 1
      else if (s === 'pending') bookings.pending += 1
    }
  } catch (err) {
    failures.push('預約狀態統計載入失敗')
    console.error('[admin/monthly] bookings failed', err)
  }

  // Payment attempts started in the window (HK days).
  const attempts = { succeeded: 0, failed: 0, expired: 0, other: 0, successRate: null as number | null }
  try {
    const { data, error } = await service.from('payment_attempts').select('status').gte('created_at', hkStart(from)).lt('created_at', hkStart(shiftDate(to, 1))).limit(20000)
    if (error) throw error
    for (const r of (data ?? []) as unknown as Row[]) {
      const s = str(r, ['status'])
      if (s === 'succeeded') attempts.succeeded += 1
      else if (s === 'failed') attempts.failed += 1
      else if (s === 'expired' || s === 'cancelled') attempts.expired += 1
      else attempts.other += 1
    }
    const all = attempts.succeeded + attempts.failed + attempts.expired + attempts.other
    attempts.successRate = all > 0 ? Math.round((attempts.succeeded / all) * 100) : null
  } catch (err) {
    failures.push('付款嘗試載入失敗')
    console.error('[admin/monthly] attempts failed', err)
  }

  // New members (hidden / test accounts excluded) with a daily series.
  const members = { newCount: 0, prevCount: 0, daily: [] as { date: string; count: number }[] }
  try {
    const { data, error } = await service.from('users').select('id, created_at').gte('created_at', hkStart(prevFrom)).lt('created_at', hkStart(shiftDate(to, 1))).limit(20000)
    if (error) throw error
    const perDay = new Map<string, number>()
    const hkDay = (iso: string) => new Date(new Date(iso).getTime() + 8 * 3600_000).toISOString().slice(0, 10)
    for (const r of (data ?? []) as unknown as Row[]) {
      const id = str(r, ['id'])
      const at = str(r, ['created_at'])
      if (!at || (id && hidden.has(id))) continue
      const d = hkDay(at)
      if (d >= from && d <= to) { members.newCount += 1; perDay.set(d, (perDay.get(d) ?? 0) + 1) }
      else if (d >= prevFrom && d <= prevTo) members.prevCount += 1
    }
    for (let i = 0; i < days; i++) {
      const d = shiftDate(from, i)
      members.daily.push({ date: d, count: perDay.get(d) ?? 0 })
    }
  } catch (err) {
    failures.push('新會員統計載入失敗')
    console.error('[admin/monthly] members failed', err)
  }

  // Site errors in the window, grouped by source.
  const errors = { total: 0, unresolved: 0, bySource: [] as { source: string; count: number }[] }
  try {
    const { data, error } = await service.from('site_error_log').select('source, resolved').eq('severity', 'error').gte('created_at', hkStart(from)).lt('created_at', hkStart(shiftDate(to, 1))).limit(5000)
    if (error) throw error
    const by = new Map<string, number>()
    for (const r of (data ?? []) as unknown as Row[]) {
      errors.total += 1
      if (r.resolved !== true) errors.unresolved += 1
      const s = str(r, ['source']) ?? 'unknown'
      by.set(s, (by.get(s) ?? 0) + 1)
    }
    errors.bySource = [...by.entries()].map(([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count).slice(0, 6)
  } catch (err) {
    failures.push('錯誤記錄載入失敗')
    console.error('[admin/monthly] errors failed', err)
  }

  return {
    month, label: monthLabel(month), from, to, partial, days, prevLabel: monthLabel(prev),
    totals: cur.totals, prevTotals: prevRev.totals, daily: cur.daily, weekday: wd,
    byMethod: cur.byMethod, byTable: cur.byTable, byPeriod: cur.byPeriod, promos: cur.promos,
    bookings, attempts, members, errors,
    error: failures.length > 0 ? failures.join('；') : null,
  }
}
