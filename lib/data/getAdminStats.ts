import { getServiceSupabase } from '@/lib/supabase/service'
import { getConfig } from '@/lib/data/getConfig'
import { num, str, type Row } from '@/lib/data/adminReadHelpers'
import { getHiddenUserList, hiddenIdFilterValue } from '@/lib/data/getHiddenUserIds'

// Dashboard stats. Each stat is computed independently and wrapped in its own
// try/catch — bookings/users/points_ledger schemas aren't pinned by a
// migration (see lib/data/getMember.ts), so a failure in one stat degrades to
// zero rather than blanking the whole dashboard.

export type AdminStats = {
  revenue: { today: number; week: number; month: number }
  bookingsCount: { today: number; week: number; month: number }
  newMembers: { week: number; month: number }
  tableUtilization: number // 0-1
  revenueTrend: { today: number | null; week: number | null; month: number | null } // signed % delta vs prior equal period, null if prior period is 0
}

export type RevenuePoint = { day: string; revenue: number; bookings: number }

export type LiveOccupancy = { tablesInUse: number; totalTables: number }

function startOfDayISO(d: Date): string {
  const copy = new Date(d)
  copy.setHours(0, 0, 0, 0)
  return copy.toISOString()
}

function daysAgo(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}

export async function getAdminStats(): Promise<AdminStats> {
  const service = getServiceSupabase()
  const today = startOfDayISO(new Date())
  const weekStart = startOfDayISO(daysAgo(7))
  const monthStart = startOfDayISO(daysAgo(30))
  const prevWeekStart = startOfDayISO(daysAgo(14))
  const prevMonthStart = startOfDayISO(daysAgo(60))
  const yesterday = startOfDayISO(daysAgo(1))

  const revenue = { today: 0, week: 0, month: 0 }
  const bookingsCount = { today: 0, week: 0, month: 0 }
  const prevRevenue = { today: 0, week: 0, month: 0 }
  try {
    // Aggregate `bookings` directly instead of `admin_revenue_daily`: the view
    // has no hidden-user join, so it re-includes admin accounts in every total.
    const hidden = await getHiddenUserList()
    const { data } = await service
      .from('bookings')
      .select('date, total_price, user_id')
      .eq('status', 'confirmed')
      .eq('is_test', false)
      .gte('date', prevMonthStart.slice(0, 10))
    const rows = (data ?? []) as Row[]
    for (const row of rows) {
      const uid = typeof row.user_id === 'string' ? row.user_id : null
      if (uid !== null && hidden.ids.has(uid)) continue
      const day = str(row, ['date']) ?? ''
      if (day === '') continue
      const rev = num(row, ['total_price'], 0)
      const cnt = 1
      if (day >= monthStart.slice(0, 10)) {
        revenue.month += rev
        bookingsCount.month += cnt
      } else if (day >= prevMonthStart.slice(0, 10)) {
        prevRevenue.month += rev
      }
      if (day >= weekStart.slice(0, 10)) {
        revenue.week += rev
        bookingsCount.week += cnt
      } else if (day >= prevWeekStart.slice(0, 10)) {
        prevRevenue.week += rev
      }
      if (day >= today.slice(0, 10)) {
        revenue.today += rev
        bookingsCount.today += cnt
      } else if (day >= yesterday.slice(0, 10)) {
        prevRevenue.today += rev
      }
    }
  } catch (revenueErr) {
    // A hidden-list failure must not silently over-report revenue.
    console.error('[admin/stats] revenue aggregate failed', revenueErr)
  }

  function pctDelta(current: number, prior: number): number | null {
    if (prior === 0) return null
    return Math.round(((current - prior) / prior) * 100)
  }

  const revenueTrend = {
    today: pctDelta(revenue.today, prevRevenue.today),
    week: pctDelta(revenue.week, prevRevenue.week),
    month: pctDelta(revenue.month, prevRevenue.month),
  }

  const newMembers = { week: 0, month: 0 }
  try {
    const hidden = await getHiddenUserList()
    const exclude = hiddenIdFilterValue(hidden.ids)
    let weekQ = service
      .from('users')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', weekStart)
    if (exclude) weekQ = weekQ.not('id', 'in', exclude)
    const { count: weekCount } = await weekQ
    newMembers.week = weekCount ?? 0
    let monthQ = service
      .from('users')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', monthStart)
    if (exclude) monthQ = monthQ.not('id', 'in', exclude)
    const { count: monthCount } = await monthQ
    newMembers.month = monthCount ?? 0
  } catch {
    /* users.created_at not confirmed — stays zero */
  }

  let tableUtilization = 0
  try {
    const config = await getConfig()
    const hidden = await getHiddenUserList()
    const exclude = hiddenIdFilterValue(hidden.ids)
    let utilQ = service
      .from('bookings')
      .select('duration_hours')
      .eq('status', 'confirmed')
      .eq('is_test', false)
      .gte('date', weekStart.slice(0, 10))
    if (exclude) utilQ = utilQ.not('user_id', 'in', exclude)
    const { data } = await utilQ
    const rows = (data ?? []) as Row[]
    const bookedHours = rows.reduce((sum, r) => sum + num(r, ['duration_hours'], 0), 0)
    const openHoursPerDay = Math.max(0, config.closeHour - config.openHour)
    const capacityHours = 2 /* tables */ * openHoursPerDay * 7
    tableUtilization = capacityHours > 0 ? Math.min(1, bookedHours / capacityHours) : 0
  } catch {
    /* stays zero */
  }

  return { revenue, bookingsCount, newMembers, tableUtilization, revenueTrend }
}

export async function getRevenueSeries(days = 30): Promise<RevenuePoint[]> {
  const service = getServiceSupabase()
  try {
    const hidden = await getHiddenUserList()
    const exclude = hiddenIdFilterValue(hidden.ids)
    let q = service
      .from('bookings')
      .select('date, total_price, user_id')
      .eq('status', 'confirmed')
      .eq('is_test', false)
      .gte('date', startOfDayISO(daysAgo(days)).slice(0, 10))
      .order('date', { ascending: true })
    if (exclude) q = q.not('user_id', 'in', exclude)
    const { data } = await q
    const byDay = new Map<string, { revenue: number; bookings: number }>()
    for (const row of (data ?? []) as Row[]) {
      const day = str(row, ['date']) ?? ''
      if (day === '') continue
      const acc = byDay.get(day) ?? { revenue: 0, bookings: 0 }
      acc.revenue += num(row, ['total_price'], 0)
      acc.bookings += 1
      byDay.set(day, acc)
    }
    return [...byDay.entries()].map(([day, v]) => ({ day, revenue: v.revenue, bookings: v.bookings }))
  } catch {
    return []
  }
}

export async function getLiveOccupancy(): Promise<LiveOccupancy> {
  const service = getServiceSupabase()
  try {
    const nowIso = new Date().toISOString()
    const today = nowIso.slice(0, 10)
    const hidden = await getHiddenUserList()
    const exclude = hiddenIdFilterValue(hidden.ids)
    let occQ = service
      .from('bookings')
      .select('start_time, end_time, table_number')
      .eq('status', 'confirmed')
      .eq('is_test', false)
      .eq('date', today)
    if (exclude) occQ = occQ.not('user_id', 'in', exclude)
    const { data } = await occQ
    const rows = (data ?? []) as Row[]
    const now = new Date()
    const nowTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:00`
    const inUse = rows.filter((r) => {
      const start = str(r, ['start_time'])
      const end = str(r, ['end_time'])
      return start !== null && end !== null && start <= nowTime && nowTime < end
    })
    return { tablesInUse: inUse.length, totalTables: 2 }
  } catch {
    return { tablesInUse: 0, totalTables: 2 }
  }
}
