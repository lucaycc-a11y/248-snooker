import { getServiceSupabase } from '@/lib/supabase/service'
import { getConfig, getConfigValue } from '@/lib/data/getConfig'
import { getAdminRevenue, type AdminRevenueDailyRow } from '@/lib/data/getAdminRevenue'
import { getHiddenUserList, hiddenIdFilterValue } from '@/lib/data/getHiddenUserIds'
import { num, str, type Row } from '@/lib/data/adminReadHelpers'
import { hkNow, shiftDate, type AdminTodayBooking } from '@/lib/admin/today'

// Server-only loader for the admin Home screen. Everything here excludes test
// bookings and hidden users — Home has no "include test" switch on purpose.
// Money comes from getAdminRevenue so Home, 收入 and the Excel export agree.

export type AdminHomeAttention = {
  /** payment_review bookings from the last 48 hours. */
  paymentReview: number
  /** payment_failed bookings from the last 48 hours. */
  paymentFailed: number
  /** Today's bookings still waiting for payment (status = pending). */
  unpaidToday: number
}

export type AdminHomeRecent = {
  id: string
  humanCode: string | null
  tableNumber: number
  date: string | null
  startTime: string | null
  price: number
  status: string
  userName: string | null
  createdAt: string | null
}

export type AdminHomeData = {
  /** Venue-local date being shown in the timetable, YYYY-MM-DD. */
  date: string
  /** Real venue-local today, YYYY-MM-DD. */
  todayDate: string
  nowMinutes: number
  nowTime: string
  tableCount: number
  openHour: number
  closeHour: number
  bookings: AdminTodayBooking[]
  kpi: {
    revenueToday: number
    revenueWeek: number
    bookingsToday: number
    bookingsWeek: number
    upcomingToday: number
  }
  /** Last 7 play dates ending today, oldest first. */
  weekDaily: AdminRevenueDailyRow[]
  attention: AdminHomeAttention
  recent: AdminHomeRecent[]
  /** Non-null means at least one block failed to load — zeros are not trustworthy. */
  error: string | null
}

const ATTENTION_STATUSES = ['payment_review', 'payment_failed'] as const

function isIsoDate(value: string | undefined): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

export async function getAdminHome(options?: { date?: string }): Promise<AdminHomeData> {
  const now = hkNow()
  const date = isIsoDate(options?.date) ? options.date : now.date
  const weekFrom = shiftDate(now.date, -6)
  const failures: string[] = []

  const service = getServiceSupabase()

  const config = await getConfig().catch(() => null)
  const venue = await getConfigValue<{ tables?: number }>('venue', { tables: 2 })
  const tableCount = typeof venue.tables === 'number' && venue.tables > 0 ? venue.tables : 2
  const openHour = typeof config?.openHour === 'number' ? config.openHour : 6
  const closeHour = typeof config?.closeHour === 'number' ? config.closeHour : 24

  let hiddenFilter: string | null = null
  try {
    hiddenFilter = hiddenIdFilterValue((await getHiddenUserList()).ids)
  } catch (err) {
    failures.push('隱藏帳戶清單載入失敗')
    console.error('[admin/home] hidden list failed', err)
  }

  // Timetable bookings for the chosen day.
  let bookings: AdminTodayBooking[] = []
  try {
    let q = service.from('bookings').select('*').eq('date', date).eq('is_test', false)
    if (hiddenFilter) q = q.not('user_id', 'in', hiddenFilter)
    const { data, error } = await q.order('start_time', { ascending: true })
    if (error) throw error
    const rows = (data ?? []) as unknown as Row[]
    const userIds = Array.from(
      new Set(rows.map((r) => r.user_id).filter((v): v is string => typeof v === 'string')),
    )
    const names = new Map<string, { name: string | null; phone: string | null }>()
    if (userIds.length > 0) {
      const { data: users } = await service
        .from('users')
        .select('id, display_name, phone')
        .in('id', userIds)
      for (const u of (users ?? []) as unknown as Row[]) {
        names.set(String(u.id), { name: str(u, ['display_name']), phone: str(u, ['phone']) })
      }
    }
    bookings = rows.map((row) => {
      const user = typeof row.user_id === 'string' ? names.get(row.user_id) : undefined
      return {
        id: String(row.id ?? ''),
        humanCode: str(row, ['human_code', 'booking_reference']),
        tableNumber: num(row, ['table_number'], 0),
        date: str(row, ['date']),
        startTime: str(row, ['start_time']),
        endTime: str(row, ['end_time']),
        durationHours: num(row, ['duration_hours'], 0),
        price: num(row, ['total_price', 'price'], 0),
        status: str(row, ['status']) ?? 'unknown',
        isTest: false,
        userName: user?.name ?? null,
        userPhone: user?.phone ?? null,
      }
    })
  } catch (err) {
    failures.push('時間表預約載入失敗')
    console.error('[admin/home] timetable load failed', err)
  }

  // Money: same loader as 收入, last 7 play dates.
  const revenue = await getAdminRevenue({ from: weekFrom, to: now.date })
  if (revenue.error) failures.push(revenue.error)
  const todayRow = revenue.daily.find((d) => d.date === now.date)
  const weekDaily = Array.from({ length: 7 }, (_, i) => {
    const d = shiftDate(weekFrom, i)
    return revenue.daily.find((r) => r.date === d) ?? { date: d, revenue: 0, count: 0, refund: 0 }
  })

  // Needs attention.
  const attention: AdminHomeAttention = { paymentReview: 0, paymentFailed: 0, unpaidToday: 0 }
  try {
    const since = new Date(Date.now() - 48 * 3600 * 1000).toISOString()
    let q = service
      .from('bookings')
      .select('status')
      .eq('is_test', false)
      .in('status', [...ATTENTION_STATUSES])
      .gte('created_at', since)
    if (hiddenFilter) q = q.not('user_id', 'in', hiddenFilter)
    const { data, error } = await q
    if (error) throw error
    for (const row of (data ?? []) as unknown as Row[]) {
      if (row.status === 'payment_review') attention.paymentReview += 1
      if (row.status === 'payment_failed') attention.paymentFailed += 1
    }
    let pending = service
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('is_test', false)
      .eq('date', now.date)
      .eq('status', 'pending')
    if (hiddenFilter) pending = pending.not('user_id', 'in', hiddenFilter)
    const { count, error: pendingError } = await pending
    if (pendingError) throw pendingError
    attention.unpaidToday = count ?? 0
  } catch (err) {
    failures.push('待處理事項載入失敗')
    console.error('[admin/home] attention load failed', err)
  }

  // Recent bookings (newest created first).
  let recent: AdminHomeRecent[] = []
  try {
    let q = service
      .from('bookings')
      .select('id, human_code, booking_reference, table_number, date, start_time, total_price, status, created_at, user_id')
      .eq('is_test', false)
      .order('created_at', { ascending: false })
      .limit(8)
    if (hiddenFilter) q = q.not('user_id', 'in', hiddenFilter)
    const { data, error } = await q
    if (error) throw error
    const rows = (data ?? []) as unknown as Row[]
    const userIds = Array.from(
      new Set(rows.map((r) => r.user_id).filter((v): v is string => typeof v === 'string')),
    )
    const names = new Map<string, string | null>()
    if (userIds.length > 0) {
      const { data: users } = await service.from('users').select('id, display_name').in('id', userIds)
      for (const u of (users ?? []) as unknown as Row[]) {
        names.set(String(u.id), str(u, ['display_name']))
      }
    }
    recent = rows.map((row) => ({
      id: String(row.id ?? ''),
      humanCode: str(row, ['human_code', 'booking_reference']),
      tableNumber: num(row, ['table_number'], 0),
      date: str(row, ['date']),
      startTime: str(row, ['start_time']),
      price: num(row, ['total_price'], 0),
      status: str(row, ['status']) ?? 'unknown',
      userName: typeof row.user_id === 'string' ? (names.get(row.user_id) ?? null) : null,
      createdAt: str(row, ['created_at']),
    }))
  } catch (err) {
    failures.push('最近預約載入失敗')
    console.error('[admin/home] recent load failed', err)
  }

  const liveToday = bookings.filter(
    (b) => b.date === now.date && (b.status === 'confirmed' || b.status === 'pending'),
  )

  return {
    date,
    todayDate: now.date,
    nowMinutes: now.minutes,
    nowTime: now.time,
    tableCount,
    openHour,
    closeHour,
    bookings,
    kpi: {
      revenueToday: todayRow?.revenue ?? 0,
      revenueWeek: revenue.totals.revenue,
      bookingsToday: liveToday.length,
      bookingsWeek: revenue.totals.bookingCount,
      upcomingToday: liveToday.filter((b) => {
        const [h, m] = (b.startTime ?? '0:0').split(':')
        return Number(h) * 60 + Number(m) > now.minutes
      }).length,
    },
    weekDaily,
    attention,
    recent,
    error: failures.length > 0 ? failures.join('；') : null,
  }
}
