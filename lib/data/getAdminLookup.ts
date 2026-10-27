import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'
import { num, str, type Row } from '@/lib/data/adminReadHelpers'

// Server-only loader for 客戶查詢 (/admin/lookup) — a support/debug tool.
// One box finds members (phone, member code, email, name) and bookings
// (booking code, reference, KPay order number). Picking a member shows their
// whole history; picking a booking shows its payment timeline. Unlike the
// list pages this deliberately shows test bookings too (badged), because the
// point is to see exactly what happened.

export type LookupMember = {
  id: string
  name: string | null
  phone: string | null
  email: string | null
  memberCode: string | null
  tier: string | null
  points: number
  credits: number
  phoneVerified: boolean
  blacklisted: boolean
  createdAt: string | null
}

export type LookupBooking = {
  id: string
  code: string | null
  userId: string | null
  date: string | null
  startTime: string | null
  endTime: string | null
  table: number
  price: number
  status: string
  method: string | null
  isTest: boolean
  createdAt: string | null
}

export type LookupEvent = {
  at: string
  kind: 'booking' | 'attempt' | 'event' | 'cancel' | 'notify'
  tone: 'good' | 'warn' | 'bad' | 'info' | 'mute'
  title: string
  detail: string | null
}

export type AdminLookupData = {
  query: string
  members: LookupMember[]
  bookings: LookupBooking[]
  member: LookupMember | null
  memberBookings: LookupBooking[]
  memberStats: { confirmed: number; spend: number; cancelled: number; upcoming: number } | null
  booking: LookupBooking | null
  timeline: LookupEvent[]
  error: string | null
}

const EVENT_LABEL: Record<string, string> = {
  confirmed: '預約已確認',
  webhook_paid_confirmed: 'KPay 通知已付款，預約確認',
  webhook_closed_or_failed: 'KPay 通知訂單關閉或失敗',
  reconcile_order_closed: '對賬：KPay 訂單已關閉',
  swept_expired: '逾時未付款，自動釋放',
  cancel_refused: '取消要求被拒絕',
  incident_parked: '已標記待人手處理',
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`)
}

function toMember(r: Row): LookupMember {
  return {
    id: String(r.id ?? ''),
    name: str(r, ['display_name']),
    phone: str(r, ['phone']),
    email: str(r, ['email']),
    memberCode: str(r, ['member_code']),
    tier: str(r, ['tier']),
    points: num(r, ['points'], 0),
    credits: num(r, ['credits'], 0),
    phoneVerified: r.phone_verified === true,
    blacklisted: r.is_blacklisted === true,
    createdAt: str(r, ['created_at']),
  }
}

function toBooking(r: Row): LookupBooking {
  return {
    id: String(r.id ?? ''),
    code: str(r, ['human_code', 'booking_reference']),
    userId: str(r, ['user_id']),
    date: str(r, ['date']),
    startTime: str(r, ['start_time']),
    endTime: str(r, ['end_time']),
    table: num(r, ['table_number'], 0),
    price: num(r, ['total_price'], 0),
    status: str(r, ['status']) ?? 'unknown',
    method: str(r, ['payment_method']),
    isTest: r.is_test === true,
    createdAt: str(r, ['created_at']),
  }
}

const MEMBER_COLS =
  'id, display_name, phone, email, member_code, tier, points, credits, phone_verified, is_blacklisted, created_at'
const BOOKING_COLS =
  'id, human_code, booking_reference, user_id, date, start_time, end_time, table_number, total_price, status, payment_method, is_test, created_at'

export async function getAdminLookup(input: {
  q?: string
  user?: string
  booking?: string
}): Promise<AdminLookupData> {
  const query = (input.q ?? '').trim().slice(0, 80)
  const service = getLegacyServiceSupabase()
  const failures: string[] = []
  const result: AdminLookupData = {
    query,
    members: [],
    bookings: [],
    member: null,
    memberBookings: [],
    memberStats: null,
    booking: null,
    timeline: [],
    error: null,
  }

  // 1. Search.
  if (query.length >= 2) {
    const like = `%${escapeLike(query)}%`
    const digits = query.replace(/\D/g, '')
    const memberQueries = [
      service.from('users').select(MEMBER_COLS).ilike('member_code', like).limit(10),
      service.from('users').select(MEMBER_COLS).ilike('email', like).limit(10),
      service.from('users').select(MEMBER_COLS).ilike('display_name', like).limit(10),
    ]
    if (digits.length >= 4) {
      memberQueries.push(service.from('users').select(MEMBER_COLS).ilike('phone', `%${digits.slice(-8)}%`).limit(10))
    }
    const bookingQueries = [
      service.from('bookings').select(BOOKING_COLS).ilike('human_code', like).limit(10),
      service.from('bookings').select(BOOKING_COLS).ilike('booking_reference', like).limit(10),
      service.from('bookings').select(BOOKING_COLS).ilike('provider_order_no', like).limit(10),
    ]
    try {
      const [memberRes, bookingRes] = await Promise.all([Promise.all(memberQueries), Promise.all(bookingQueries)])
      const members = new Map<string, LookupMember>()
      for (const res of memberRes) {
        if (res.error) throw res.error
        for (const r of (res.data ?? []) as unknown as Row[]) members.set(String(r.id), toMember(r))
      }
      const bookings = new Map<string, LookupBooking>()
      for (const res of bookingRes) {
        if (res.error) throw res.error
        for (const r of (res.data ?? []) as unknown as Row[]) bookings.set(String(r.id), toBooking(r))
      }
      result.members = [...members.values()].slice(0, 12)
      result.bookings = [...bookings.values()].slice(0, 12)
    } catch (err) {
      failures.push('搜尋失敗')
      console.error('[admin/lookup] search failed', err)
    }
  }

  // A single unambiguous hit opens directly.
  let userId = input.user ?? null
  let bookingId = input.booking ?? null
  if (!userId && !bookingId) {
    if (result.bookings.length === 1 && result.members.length === 0) bookingId = result.bookings[0].id
    else if (result.members.length === 1 && result.bookings.length === 0) userId = result.members[0].id
  }

  // 2. Booking detail + timeline.
  if (bookingId) {
    try {
      const { data, error } = await service.from('bookings').select(BOOKING_COLS).eq('id', bookingId).maybeSingle()
      if (error) throw error
      if (data) {
        const booking = toBooking(data as unknown as Row)
        result.booking = booking
        if (!userId && booking.userId) userId = booking.userId
        const [attempts, events, cancels, notes] = await Promise.all([
          service.from('payment_attempts').select('created_at, completed_at, provider, provider_order_no, status, failure_code, failure_reason').eq('booking_id', bookingId).order('created_at'),
          service.from('payment_events').select('created_at, event, source, from_state, to_state, reason').eq('booking_id', bookingId).order('created_at'),
          service.from('cancellation_log').select('created_at, reason, compensation_type, compensation_value').eq('booking_id', bookingId),
          service.from('notification_log').select('sent_at, channel, type, status, error_message').eq('booking_id', bookingId),
        ])
        const timeline: LookupEvent[] = []
        if (booking.createdAt) {
          timeline.push({ at: booking.createdAt, kind: 'booking', tone: 'info', title: '建立預約', detail: booking.code })
        }
        for (const r of (attempts.data ?? []) as unknown as Row[]) {
          const s = str(r, ['status']) ?? ''
          timeline.push({
            at: str(r, ['created_at']) ?? '',
            kind: 'attempt',
            tone: s === 'succeeded' ? 'good' : s === 'failed' ? 'bad' : s === 'expired' || s === 'cancelled' ? 'mute' : 'warn',
            title: `付款嘗試（${str(r, ['provider']) ?? '—'}）：${s === 'succeeded' ? '成功' : s === 'failed' ? '失敗' : s === 'expired' ? '逾時' : s === 'cancelled' ? '已取消' : s}`,
            detail: [str(r, ['provider_order_no']), str(r, ['failure_code']), str(r, ['failure_reason'])].filter(Boolean).join(' · ') || null,
          })
        }
        for (const r of (events.data ?? []) as unknown as Row[]) {
          const ev = str(r, ['event']) ?? ''
          timeline.push({
            at: str(r, ['created_at']) ?? '',
            kind: 'event',
            tone: ev.includes('confirmed') ? 'good' : ev.includes('fail') || ev.includes('refused') ? 'bad' : 'info',
            title: EVENT_LABEL[ev] ?? ev,
            detail: [str(r, ['source']), [str(r, ['from_state']), str(r, ['to_state'])].filter(Boolean).join(' → '), str(r, ['reason'])].filter(Boolean).join(' · ') || null,
          })
        }
        for (const r of (cancels.data ?? []) as unknown as Row[]) {
          timeline.push({
            at: str(r, ['created_at']) ?? '',
            kind: 'cancel',
            tone: 'warn',
            title: '管理員取消',
            detail: [str(r, ['reason']), str(r, ['compensation_type'])].filter(Boolean).join(' · ') || null,
          })
        }
        for (const r of (notes.data ?? []) as unknown as Row[]) {
          const s = str(r, ['status']) ?? ''
          timeline.push({
            at: str(r, ['sent_at']) ?? '',
            kind: 'notify',
            tone: s === 'sent' ? 'good' : s === 'failed' ? 'bad' : 'warn',
            title: `通知 ${str(r, ['channel']) ?? ''}（${str(r, ['type']) ?? ''}）：${s === 'sent' ? '已發送' : s === 'pending' ? '未發送' : s}`,
            detail: str(r, ['error_message']),
          })
        }
        result.timeline = timeline.filter((e) => e.at).sort((a, b) => a.at.localeCompare(b.at))
      }
    } catch (err) {
      failures.push('預約記錄載入失敗')
      console.error('[admin/lookup] booking failed', err)
    }
  }

  // 3. Member profile + bookings.
  if (userId) {
    try {
      const [{ data: user, error: userError }, { data: rows, error: bookingsError }] = await Promise.all([
        service.from('users').select(MEMBER_COLS).eq('id', userId).maybeSingle(),
        service.from('bookings').select(BOOKING_COLS).eq('user_id', userId).order('date', { ascending: false }).order('start_time', { ascending: false }).limit(60),
      ])
      if (userError) throw userError
      if (bookingsError) throw bookingsError
      if (user) result.member = toMember(user as unknown as Row)
      result.memberBookings = ((rows ?? []) as unknown as Row[]).map(toBooking)
      const real = result.memberBookings.filter((b) => !b.isTest)
      const today = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10)
      result.memberStats = {
        confirmed: real.filter((b) => b.status === 'confirmed').length,
        spend: real.filter((b) => b.status === 'confirmed').reduce((s, b) => s + b.price, 0),
        cancelled: real.filter((b) => b.status === 'cancelled' || b.status === 'admin_cancelled').length,
        upcoming: real.filter((b) => b.status === 'confirmed' && (b.date ?? '') >= today).length,
      }
    } catch (err) {
      failures.push('會員資料載入失敗')
      console.error('[admin/lookup] member failed', err)
    }
  }

  result.error = failures.length > 0 ? failures.join('；') : null
  return result
}
