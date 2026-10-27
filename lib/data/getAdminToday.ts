import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'
import { getConfigValue } from '@/lib/data/getConfig'
import { num, str, type Row } from '@/lib/data/adminReadHelpers'
import {
  bookingPhase,
  hkNow,
  shiftDate,
  type AdminTodayBooking,
  type AdminTodayData,
  type AdminTodayStats,
  type AdminTodayWeekPoint,
} from '@/lib/admin/today'

// Server-only loader for the 今日 dashboard (`space8-admin.html` vToday).
// Pure types and time helpers live in lib/admin/today.ts so client components
// can share them without dragging `next/headers` into the browser bundle.

export type {
  AdminTodayBooking,
  AdminTodayData,
  AdminTodayStats,
  AdminTodayWeekPoint,
} from '@/lib/admin/today'

function normalize(row: Row): AdminTodayBooking {
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
    isTest: row.is_test === true,
    userName: null,
    userPhone: null,
  }
}

export async function getAdminToday(options?: {
  includeTest?: boolean
}): Promise<AdminTodayData> {
  const includeTest = options?.includeTest ?? false
  const { date, time, minutes } = hkNow()

  const service = getLegacyServiceSupabase()

  const venue = await getConfigValue<{ tables?: number }>('venue', { tables: 2 })
  const tableCount =
    typeof venue.tables === 'number' && venue.tables > 0 ? venue.tables : 2

  // −3…+3 window around today, matching the prototype's chart7().
  const weekDates = Array.from({ length: 7 }, (_, i) => shiftDate(date, i - 3))

  let rows: Row[] = []
  let loadError: string | null = null
  try {
    let q = service.from('bookings').select('*, users(display_name, phone)').in('date', weekDates)
    if (!includeTest) q = q.eq('is_test', false)
    const { data, error } = await q
    if (error) throw error
    rows = (data ?? []) as (Row & {
      users: { display_name: string | null; phone: string | null } | null
    })[]
  } catch {
    // Join is best-effort — bookings.user_id -> users.id is not a declared FK.
    try {
      let q = service.from('bookings').select('*').in('date', weekDates)
      if (!includeTest) q = q.eq('is_test', false)
      const { data, error } = await q
      if (error) throw error
      rows = (data ?? []) as Row[]
    } catch (err) {
      // Never an empty success — the dashboard must say the read failed
      // rather than render "今日沒有預約" over a real outage.
      rows = []
      const message = err instanceof Error ? err.message : String(err)
      loadError = `預約資料載入失敗：${message}`
      console.error('[admin/today] bookings load failed', err)
    }
  }

  // bookings.user_id -> users.id is not a declared FK, so the embedded join above always
  // falls back to a plain read. Resolve names/phones with one explicit batch lookup instead.
  const names = new Map<string, { display_name: string | null; phone: string | null }>()
  const userIds = Array.from(
    new Set(rows.map((r) => r.user_id).filter((v): v is string => typeof v === 'string')),
  )
  if (userIds.length > 0) {
    const { data: users } = await service.from('users').select('id, display_name, phone').in('id', userIds)
    for (const u of (users ?? []) as unknown as { id: string; display_name: string | null; phone: string | null }[]) {
      names.set(u.id, { display_name: u.display_name, phone: u.phone })
    }
  }

  const bookings = rows.map((row) => {
    const b = normalize(row)
    const joined =
      (row.users as { display_name: string | null; phone: string | null } | null) ??
      (typeof row.user_id === 'string' ? names.get(row.user_id) ?? null : null)
    if (joined) {
      b.userName = joined.display_name
      b.userPhone = joined.phone
    }
    return b
  })

  // Chart counts only the live statuses, as the prototype does.
  const week: AdminTodayWeekPoint[] = weekDates.map((d) => ({
    date: d,
    count: bookings.filter(
      (b) => b.date === d && (b.status === 'confirmed' || b.status === 'pending'),
    ).length,
    isToday: d === date,
  }))

  const todays = bookings
    .filter((b) => b.date === date)
    .sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? ''))

  const live = todays.filter(
    (b) => b.status === 'confirmed' || b.status === 'pending',
  )
  const stats: AdminTodayStats = {
    total: live.length,
    live: live.filter((b) => bookingPhase(b, minutes) === '進行中').length,
    upcoming: live.filter((b) => bookingPhase(b, minutes) === '未開始').length,
    unpaid: todays.filter((b) => b.status === 'pending').length,
  }

  return {
    date,
    nowTime: time,
    nowMinutes: minutes,
    bookings: todays,
    stats,
    week,
    tableCount,
    error: loadError,
  }
}
