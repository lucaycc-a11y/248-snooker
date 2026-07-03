import { getServiceSupabase } from '@/lib/supabase/service'
import { getConfig } from '@/lib/data/getConfig'
import { num, str, type Row } from '@/lib/data/adminReadHelpers'

// Calendar data for /admin/calendar. Same defensive-query conventions as
// getAdminBookings.ts/getAdminStats.ts — bookings/slots schemas are
// RPC-confirmed, not migration-confirmed.

const TOTAL_TABLES = 2

export type DayDensity = {
  date: string // YYYY-MM-DD
  bookingsCount: number
  utilization: number // 0-1
}

export type CalendarBooking = {
  id: string
  bookingReference: string | null
  userEmail: string | null
  userName: string | null
  tableNumber: number
  startTime: string | null
  endTime: string | null
  status: string
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function monthRange(year: number, month: number): { start: string; end: string; daysInMonth: number } {
  const daysInMonth = new Date(year, month, 0).getDate()
  const start = `${year}-${pad(month)}-01`
  const end = `${year}-${pad(month)}-${pad(daysInMonth)}`
  return { start, end, daysInMonth }
}

export async function getMonthDensity(year: number, month: number): Promise<DayDensity[]> {
  const { start, end, daysInMonth } = monthRange(year, month)
  const service = getServiceSupabase()

  const byDay = new Map<string, { count: number; hours: number }>()
  for (let d = 1; d <= daysInMonth; d++) {
    byDay.set(`${year}-${pad(month)}-${pad(d)}`, { count: 0, hours: 0 })
  }

  try {
    const { data } = await service
      .from('bookings')
      .select('date, duration_hours')
      .eq('status', 'confirmed')
      .gte('date', start)
      .lte('date', end)
    const rows = (data ?? []) as Row[]
    for (const r of rows) {
      const date = str(r, ['date'])
      if (!date || !byDay.has(date)) continue
      const entry = byDay.get(date)!
      entry.count += 1
      entry.hours += num(r, ['duration_hours'], 0)
    }
  } catch {
    /* stays zeroed */
  }

  let openHoursPerDay = 18 // 06:00-24:00 fallback
  try {
    const config = await getConfig()
    openHoursPerDay = Math.max(0, config.closeHour - config.openHour)
  } catch {
    /* keep fallback */
  }
  const capacityHours = TOTAL_TABLES * openHoursPerDay

  return Array.from(byDay.entries()).map(([date, entry]) => ({
    date,
    bookingsCount: entry.count,
    utilization: capacityHours > 0 ? Math.min(1, entry.hours / capacityHours) : 0,
  }))
}

export async function getDayTimeline(date: string): Promise<CalendarBooking[]> {
  const service = getServiceSupabase()

  try {
    const { data, error } = await service
      .from('bookings')
      .select('id, booking_reference, table_number, start_time, end_time, status, users(email, display_name)')
      .eq('date', date)
      .eq('status', 'confirmed')
      .order('start_time', { ascending: true })
    if (error) throw error

    const rows = (data ?? []) as unknown as Row[]
    return rows.map((r) => {
      const usersField = r.users
      const userInfo = Array.isArray(usersField) ? (usersField[0] as Row | undefined) : (usersField as Row | null)
      return {
        id: String(r.id ?? ''),
        bookingReference: str(r, ['booking_reference']),
        userEmail: userInfo ? str(userInfo, ['email']) : null,
        userName: userInfo ? str(userInfo, ['display_name']) : null,
        tableNumber: num(r, ['table_number'], 0),
        startTime: str(r, ['start_time']),
        endTime: str(r, ['end_time']),
        status: str(r, ['status']) ?? 'confirmed',
      }
    })
  } catch {
    // Fallback: no embedded join — two queries merged in memory.
    try {
      const { data } = await service
        .from('bookings')
        .select('id, booking_reference, table_number, start_time, end_time, status, user_id')
        .eq('date', date)
        .eq('status', 'confirmed')
        .order('start_time', { ascending: true })
      const rows = (data ?? []) as Row[]

      const userIds = Array.from(new Set(rows.map((r) => r.user_id).filter((v): v is string => typeof v === 'string')))
      let usersById = new Map<string, { email: string | null; display_name: string | null }>()
      if (userIds.length > 0) {
        const { data: users } = await service.from('users').select('id, email, display_name').in('id', userIds)
        usersById = new Map(
          ((users ?? []) as Row[]).map((u) => [
            String(u.id),
            { email: str(u, ['email']), display_name: str(u, ['display_name']) },
          ])
        )
      }

      return rows.map((r) => {
        const info = typeof r.user_id === 'string' ? usersById.get(r.user_id) : undefined
        return {
          id: String(r.id ?? ''),
          bookingReference: str(r, ['booking_reference']),
          userEmail: info?.email ?? null,
          userName: info?.display_name ?? null,
          tableNumber: num(r, ['table_number'], 0),
          startTime: str(r, ['start_time']),
          endTime: str(r, ['end_time']),
          status: str(r, ['status']) ?? 'confirmed',
        }
      })
    } catch (fallbackError) {
      console.error('[admin/calendar] day timeline query failed', fallbackError)
      return []
    }
  }
}

export { TOTAL_TABLES }
