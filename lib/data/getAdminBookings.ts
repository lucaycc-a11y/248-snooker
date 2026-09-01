import { getServiceSupabase } from '@/lib/supabase/service'
import { num, str, type Row } from '@/lib/data/adminReadHelpers'

// Shared query logic for /admin/bookings — used directly by the Server
// Component for first paint and by app/api/admin/bookings/route.ts for
// client-side re-fetches on filter/page change. Schema caveat: bookings.user_id
// -> users.id isn't confirmed to be a declared Postgres FK (no migration ever
// created either table), which PostgREST's embedded-resource select requires.
// Tries the join first; falls back to two separate queries + an in-memory
// merge if the join throws.

const PAGE_SIZE = 50

export type AdminBookingRow = {
  id: string
  humanCode: string | null
  bookingReference: string | null
  userEmail: string | null
  userName: string | null
  userPhone: string | null
  tableNumber: number
  date: string | null
  startTime: string | null
  endTime: string | null
  price: number
  status: string
  paymentMethod: string | null
  isTest: boolean
}

export type AdminBookingsQuery = {
  page?: number
  status?: string | null
  dateFrom?: string | null
  dateTo?: string | null
  tableNumber?: string | null
  search?: string | null
  isTest?: boolean | null // unset = real only (default), true = test only, false = real only (explicit)
}

export type AdminBookingsResult = { bookings: AdminBookingRow[]; total: number; page: number; pageSize: number }

function normalize(row: Row, userInfo: { email: string | null; display_name: string | null; phone: string | null } | null): AdminBookingRow {
  return {
    id: String(row.id ?? ''),
    humanCode: str(row, ['human_code']),
    bookingReference: str(row, ['booking_reference']),
    userEmail: userInfo?.email ?? null,
    userName: userInfo?.display_name ?? null,
    userPhone: userInfo?.phone ?? null,
    tableNumber: num(row, ['table_number'], 0),
    date: str(row, ['date']),
    startTime: str(row, ['start_time']),
    endTime: str(row, ['end_time']),
    price: num(row, ['total_price'], 0),
    status: str(row, ['status']) ?? 'unknown',
    paymentMethod: str(row, ['payment_method']),
    isTest: row.is_test === true,
  }
}

export async function getAdminBookings(query: AdminBookingsQuery): Promise<AdminBookingsResult> {
  const page = Math.max(1, query.page ?? 1)
  const { status, dateFrom, dateTo, tableNumber, search } = query
  // Default (isTest undefined/null): show real bookings only, matching the
  // spec's "show test bookings" toggle defaulting to off.
  const isTest = query.isTest ?? false

  const service = getServiceSupabase()
  const from = (page - 1) * PAGE_SIZE
  const to = page * PAGE_SIZE - 1

  function applyFilters<T>(q: T): T {
    let query = q as unknown as {
      eq: (col: string, val: unknown) => typeof query
      gte: (col: string, val: unknown) => typeof query
      lte: (col: string, val: unknown) => typeof query
      or: (expr: string) => typeof query
    }
    query = query.eq('is_test', isTest)
    if (status) query = query.eq('status', status)
    if (dateFrom) query = query.gte('date', dateFrom)
    if (dateTo) query = query.lte('date', dateTo)
    if (tableNumber) query = query.eq('table_number', Number(tableNumber))
    if (search) query = query.or(`booking_reference.ilike.%${search}%,human_code.ilike.%${search}%`)
    return query as unknown as T
  }

  try {
    let q = service
      .from('bookings')
      .select('*, users(email, display_name, phone)', { count: 'exact' })
      .order('date', { ascending: false })
      .range(from, to)
    q = applyFilters(q)
    const { data, error, count } = await q
    if (error) throw error

    const rows = (data ?? []) as (Row & { users: { email: string | null; display_name: string | null; phone: string | null } | null })[]
    const bookings = rows.map((r) => normalize(r, r.users))
    return { bookings, total: count ?? 0, page, pageSize: PAGE_SIZE }
  } catch {
    try {
      let q = service.from('bookings').select('*', { count: 'exact' }).order('date', { ascending: false }).range(from, to)
      q = applyFilters(q)
      const { data, error, count } = await q
      if (error) throw error

      const rows = (data ?? []) as Row[]
      const userIds = Array.from(new Set(rows.map((r) => r.user_id).filter((v): v is string => typeof v === 'string')))
      let usersById = new Map<string, { email: string | null; display_name: string | null; phone: string | null }>()
      if (userIds.length > 0) {
        const { data: users } = await service.from('users').select('id, email, display_name, phone').in('id', userIds)
        usersById = new Map(
          ((users ?? []) as Row[]).map((u) => [
            String(u.id),
            { email: str(u, ['email']), display_name: str(u, ['display_name']), phone: str(u, ['phone']) },
          ])
        )
      }

      const bookings = rows.map((r) =>
        normalize(r, typeof r.user_id === 'string' ? (usersById.get(r.user_id) ?? null) : null)
      )
      return { bookings, total: count ?? 0, page, pageSize: PAGE_SIZE }
    } catch (fallbackError) {
      console.error('[admin/bookings] query failed', fallbackError)
      return { bookings: [], total: 0, page, pageSize: PAGE_SIZE }
    }
  }
}
