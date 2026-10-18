import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'
import { num, str, type Row } from '@/lib/data/adminReadHelpers'
import { logSiteError } from '@/lib/errors/log'
import { getHiddenUserList, hiddenIdFilterValue } from '@/lib/data/getHiddenUserIds'

// Shared query logic for /admin/bookings — used directly by the Server
// Component for first paint and by app/api/admin/bookings/route.ts for
// client-side re-fetches on filter/page change. Schema caveat: bookings.user_id
// -> users.id isn't confirmed to be a declared Postgres FK (no migration ever
// created either table), which PostgREST's embedded-resource select requires.
// Tries the join first; falls back to two separate queries + an in-memory
// merge if the join throws.

// Prototype `PAGE` — the reference footer reads `共 16 筆 / 1 / 2`, i.e. 8 rows
// per page. Keep in sync with the pager in BookingsPageClient.
const PAGE_SIZE = 8

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
  /** Exact booking id (drawer lookup). Ignores the real/test default so test bookings open too. */
  bookingId?: string | null
  isTest?: boolean | null // unset = real only (default), true = test only, false = real only (explicit)
}

export type AdminBookingsResult = {
  bookings: AdminBookingRow[]
  total: number
  page: number
  pageSize: number
  /**
   * Load failure message. Non-null means the list is NOT a real empty result —
   * the UI must show an error banner rather than 「找不到預約」.
   */
  error: string | null
}

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
  const bookingId = query.bookingId ?? null
  const isTest = bookingId ? null : (query.isTest ?? false)

  const service = getLegacyServiceSupabase()
  const from = (page - 1) * PAGE_SIZE
  const to = page * PAGE_SIZE - 1

  // Hidden accounts are filtered here, in the shared loader — never in the
  // browser. A read failure returns the error result rather than silently
  // listing admin bookings as customer bookings.
  let hiddenIds: Set<string>
  try {
    hiddenIds = (await getHiddenUserList()).ids
  } catch (hiddenErr) {
    const message = hiddenErr instanceof Error ? hiddenErr.message : String(hiddenErr)
    console.error('[admin/bookings] hidden-user list failed', hiddenErr)
    await logSiteError('admin.bookings', 'error', '隱藏帳戶清單載入失敗', { message })
    return {
      bookings: [],
      total: 0,
      page,
      pageSize: PAGE_SIZE,
      error: message,
    }
  }

  // Prototype haystack is `[hc, ref, phone, member code]`. Booking columns are
  // filterable in one PostgREST `or`, but phone / member code / name live on
  // `users`, so resolve those to ids first and fold them into the same clause.
  // (The bookings->users FK is not declared, so an embedded select cannot do
  // this for us — see the join-fallback below.)
  let searchUserIds: string[] = []
  if (search) {
    // Neutralise LIKE wildcards in user input; try both the raw and the
    // space-stripped form so "6128 4501" finds a phone stored as "61284501".
    const safe = (s: string) => `%${s.replace(/[%_\\]/g, ' ')}%`
    const raw = safe(search)
    const tight = safe(search.replace(/\s+/g, ''))
    const { data: matchedUsers } = await service
      .from('users')
      .select('id')
      .or(
        [
          `phone.ilike.${raw}`,
          `phone.ilike.${tight}`,
          `member_code.ilike.${tight}`,
          `display_name.ilike.${raw}`,
        ].join(','),
      )
      .limit(200)
    searchUserIds = ((matchedUsers ?? []) as { id: string }[]).map((u) => u.id)
  }

  function applyFilters<T>(q: T): T {
    let query = q as unknown as {
      eq: (col: string, val: unknown) => typeof query
      gte: (col: string, val: unknown) => typeof query
      lte: (col: string, val: unknown) => typeof query
      or: (expr: string) => typeof query
      not: (col: string, op: string, val: string) => typeof query
    }
    if (isTest !== null) query = query.eq('is_test', isTest)
    if (bookingId) query = query.eq('id', bookingId)
    const hiddenFilter = hiddenIdFilterValue(hiddenIds)
    if (hiddenFilter) query = query.not('user_id', 'in', hiddenFilter)
    if (status) query = query.eq('status', status)
    if (dateFrom) query = query.gte('date', dateFrom)
    if (dateTo) query = query.lte('date', dateTo)
    if (tableNumber) query = query.eq('table_number', Number(tableNumber))
    if (search) {
      // Strip spaces so "S8 261007" matches "S8-261007"-style codes too.
      const term = search.replace(/[%_\\]/g, ' ').replace(/\s+/g, '')
      const clauses = [
        `booking_reference.ilike.%${term}%`,
        `human_code.ilike.%${term}%`,
      ]
      if (searchUserIds.length > 0) {
        clauses.push(`user_id.in.(${searchUserIds.join(',')})`)
      }
      query = query.or(clauses.join(','))
    }
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
    return { bookings, total: count ?? 0, page, pageSize: PAGE_SIZE, error: null }
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
      return { bookings, total: count ?? 0, page, pageSize: PAGE_SIZE, error: null }
    } catch (fallbackError) {
      const message = fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
      console.error('[admin/bookings] query failed', fallbackError)
      await logSiteError('admin.bookings', 'error', '預約資料載入失敗', { message })
      return {
        bookings: [],
        total: 0,
        page,
        pageSize: PAGE_SIZE,
        error: `預約資料載入失敗：${message}`,
      }
    }
  }
}
