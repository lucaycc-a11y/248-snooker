import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'
import { getHiddenUserList } from '@/lib/data/getHiddenUserIds'

/**
 * 跟進名單 — people the venue should follow up with.
 *  1. unpaid:   a real (non-test) booking attempt that never became `confirmed`
 *               (pending / payment_failed / expired). `payment_attempts` is empty
 *               in production, so `bookings.status` is the only reliable signal.
 *  2. noBooking: signed-up members with no real confirmed booking.
 * Hidden accounts are excluded here, once, never in the browser. A read failure
 * is returned as `error`, never as an empty list.
 */

export type UnpaidAttempt = {
  bookingId: string
  humanCode: string | null
  status: 'pending' | 'payment_failed' | 'expired'
  date: string | null
  startTime: string | null
  tableNumber: number | null
  price: number
  createdAt: string
  paymentMethod: string | null
  promoCode: string | null
}

export type UnpaidPerson = {
  userId: string
  displayName: string | null
  phone: string | null
  email: string | null
  memberCode: string | null
  attempts: UnpaidAttempt[]
  lastAttemptAt: string
  /** True if the person later paid for some booking (so probably no chase needed). */
  paidLater: boolean
  confirmedCount: number
}

export type NoBookingPerson = {
  userId: string
  displayName: string | null
  phone: string | null
  email: string | null
  memberCode: string | null
  createdAt: string
  daysSinceSignup: number
  /** Had an unpaid attempt (tried to book but did not pay). */
  hasUnpaidAttempt: boolean
  phoneVerified: boolean
}

export type FollowUps = {
  unpaid: UnpaidPerson[]
  noBooking: NoBookingPerson[]
  /** How far back unpaid attempts are listed. */
  unpaidDays: number
  error: string | null
}

type UserRow = {
  id: string
  display_name: string | null
  phone: string | null
  email: string | null
  member_code: string | null
  created_at: string
  phone_verified: boolean | null
}
type BookingRow = {
  id: string
  user_id: string
  human_code: string | null
  status: string
  date: string | null
  start_time: string | null
  table_number: number | null
  total_price: number | string | null
  created_at: string
  payment_method: string | null
  promo_code: string | null
}

const UNPAID = new Set(['pending', 'payment_failed', 'expired'])

export async function getAdminFollowUps(opts: { unpaidDays?: number } = {}): Promise<FollowUps> {
  const unpaidDays = Math.min(Math.max(opts.unpaidDays ?? 14, 1), 90)
  const empty: FollowUps = { unpaid: [], noBooking: [], unpaidDays, error: null }
  try {
    const service = getLegacyServiceSupabase()
    const hidden = (await getHiddenUserList()).ids

    const [usersRes, bookingsRes] = await Promise.all([
      service
        .from('users')
        .select('id, display_name, phone, email, member_code, created_at, phone_verified')
        .order('created_at', { ascending: false })
        .limit(5000),
      service
        .from('bookings')
        .select('id, user_id, human_code, status, date, start_time, table_number, total_price, created_at, payment_method, promo_code')
        .eq('is_test', false)
        .order('created_at', { ascending: false })
        .limit(10000),
    ])
    if (usersRes.error) throw new Error(`會員資料：${usersRes.error.message}`)
    if (bookingsRes.error) throw new Error(`預約資料：${bookingsRes.error.message}`)

    const users = ((usersRes.data ?? []) as UserRow[]).filter((u) => !hidden.has(u.id))
    const userById = new Map(users.map((u) => [u.id, u]))
    const bookings = ((bookingsRes.data ?? []) as BookingRow[]).filter((b) => !hidden.has(b.user_id))

    const lastConfirmed = new Map<string, string>() // user → latest confirmed created_at
    const confirmedCount = new Map<string, number>()
    for (const b of bookings) {
      if (b.status !== 'confirmed') continue
      confirmedCount.set(b.user_id, (confirmedCount.get(b.user_id) ?? 0) + 1)
      const cur = lastConfirmed.get(b.user_id)
      if (!cur || b.created_at > cur) lastConfirmed.set(b.user_id, b.created_at)
    }

    const cutoff = Date.now() - unpaidDays * 86_400_000
    const byUser = new Map<string, UnpaidAttempt[]>()
    const everUnpaid = new Set<string>()
    for (const b of bookings) {
      if (!UNPAID.has(b.status)) continue
      everUnpaid.add(b.user_id)
      if (Date.parse(b.created_at) < cutoff) continue
      const list = byUser.get(b.user_id) ?? []
      list.push({
        bookingId: b.id,
        humanCode: b.human_code,
        status: b.status as UnpaidAttempt['status'],
        date: b.date,
        startTime: b.start_time,
        tableNumber: b.table_number,
        price: Number(b.total_price ?? 0),
        createdAt: b.created_at,
        paymentMethod: b.payment_method,
        promoCode: b.promo_code,
      })
      byUser.set(b.user_id, list)
    }

    const unpaid: UnpaidPerson[] = []
    for (const [userId, attempts] of byUser) {
      const u = userById.get(userId)
      if (!u) continue
      const lastAttemptAt = attempts[0].createdAt // bookings are newest-first
      const paid = lastConfirmed.get(userId)
      unpaid.push({
        userId,
        displayName: u.display_name,
        phone: u.phone,
        email: u.email,
        memberCode: u.member_code,
        attempts,
        lastAttemptAt,
        paidLater: !!paid && paid > lastAttemptAt,
        confirmedCount: confirmedCount.get(userId) ?? 0,
      })
    }
    unpaid.sort((a, b) => Number(a.paidLater) - Number(b.paidLater) || b.lastAttemptAt.localeCompare(a.lastAttemptAt))

    const now = Date.now()
    const noBooking: NoBookingPerson[] = users
      .filter((u) => !confirmedCount.has(u.id))
      .map((u) => ({
        userId: u.id,
        displayName: u.display_name,
        phone: u.phone,
        email: u.email,
        memberCode: u.member_code,
        createdAt: u.created_at,
        daysSinceSignup: Math.floor((now - Date.parse(u.created_at)) / 86_400_000),
        hasUnpaidAttempt: everUnpaid.has(u.id),
        phoneVerified: u.phone_verified === true,
      }))

    return { ...empty, unpaid, noBooking }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[admin/follow-ups] failed', err)
    return { ...empty, error: `跟進名單載入失敗：${message}` }
  }
}
