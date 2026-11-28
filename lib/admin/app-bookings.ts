import { str, num, type Row } from '@/lib/data/adminReadHelpers'
import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'
import { getHiddenUserList, hiddenIdFilterValue } from '@/lib/data/getHiddenUserIds'

export function hkToday(): string {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10)
}

export function mapBooking(r: Row, user?: { display_name: string | null; phone: string | null } | null) {
  return {
    id: String(r.id ?? ''),
    humanCode: str(r, ['human_code', 'booking_reference']),
    date: str(r, ['date']),
    startTime: str(r, ['start_time']),
    endTime: str(r, ['end_time']),
    durationHours: num(r, ['duration_hours'], 0),
    tableNumber: num(r, ['table_number'], 0),
    status: str(r, ['status']) ?? 'unknown',
    totalPrice: num(r, ['total_price'], 0),
    paymentMethod: str(r, ['payment_method']),
    isTest: r.is_test === true,
    userName: user?.display_name ?? str(r, ['user_name']),
    userPhone: user?.phone ?? null,
    userEmail: str(r, ['user_email']),
    createdAt: str(r, ['created_at']),
  }
}

export type AppBooking = ReturnType<typeof mapBooking>

export type AppBookingsQuery = {
  from: string
  to: string
  /** true = also test bookings and hidden accounts (the 顯示測試預約 switch). */
  includeTest: boolean
  status?: string | null
  limit: number
  offset: number
  /** Order by when the booking was made (newest first) instead of by play time. */
  newestFirst?: boolean
}

export type AppBookingsResult =
  | { ok: true; total: number | null; nextOffset: number | null; bookings: AppBooking[] }
  | { ok: false; error: string }

/**
 * The one place that decides which bookings the iOS app sees, so /bookings and /overview cannot disagree:
 * test and hidden-account bookings only with includeTest, same as the web 今日 / 預約 screens.
 */
export async function loadAppBookings(opts: AppBookingsQuery): Promise<AppBookingsResult> {
  const db = getLegacyServiceSupabase()
  let q = db.from('bookings').select('*', { count: 'exact' }).gte('date', opts.from).lte('date', opts.to)
  q = opts.newestFirst
    ? q.order('created_at', { ascending: false })
    : q.order('date', { ascending: true }).order('start_time', { ascending: true })
  q = q.range(opts.offset, opts.offset + opts.limit - 1)

  if (!opts.includeTest) {
    q = q.eq('is_test', false)
    try {
      const hidden = hiddenIdFilterValue((await getHiddenUserList()).ids)
      if (hidden) q = q.not('user_id', 'in', hidden)
    } catch (err) {
      // Never fall back to "show everything" when the hidden list cannot be read.
      console.error('[admin/app/bookings] hidden-user list failed', err)
      return { ok: false, error: 'Could not load hidden accounts' }
    }
  }
  if (opts.status) q = q.eq('status', opts.status)

  const { data, error, count } = await q
  if (error) return { ok: false, error: 'Could not load bookings' }
  const rows = (data ?? []) as Row[]

  const ids = Array.from(new Set(rows.map((r) => r.user_id).filter((v): v is string => typeof v === 'string')))
  const users = new Map<string, { display_name: string | null; phone: string | null }>()
  if (ids.length > 0) {
    const { data: us } = await db.from('users').select('id, display_name, phone').in('id', ids)
    for (const u of (us ?? []) as { id: string; display_name: string | null; phone: string | null }[]) users.set(u.id, u)
  }

  return {
    ok: true,
    total: count,
    nextOffset: count !== null && opts.offset + rows.length < count ? opts.offset + rows.length : null,
    bookings: rows.map((r) => mapBooking(r, typeof r.user_id === 'string' ? users.get(r.user_id) : null)),
  }
}
