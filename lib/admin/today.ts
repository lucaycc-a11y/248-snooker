/**
 * Pure helpers and types for the 今日 dashboard.
 *
 * Nothing in this file may import a Supabase client or `next/headers` — it is
 * shared by the server data loader (lib/data/getAdminToday.ts) and by client
 * components. A value import from a client component into a module that pulls
 * `next/headers` breaks the production build.
 *
 * Time trap: `bookings.date` / `start_time` are Hong Kong wall-clock, while the
 * database `TimeZone` is UTC. Anything that derives "today" from `new Date()`
 * in UTC is 8 hours wrong. Everything here goes through `hkNow()`.
 */

export type AdminTodayBooking = {
  id: string
  humanCode: string | null
  tableNumber: number
  date: string | null
  startTime: string | null
  endTime: string | null
  durationHours: number
  price: number
  status: string
  isTest: boolean
  userName: string | null
  userPhone: string | null
}

export type AdminTodayStats = {
  /** confirmed + pending, excluding tests when the toggle is off. */
  total: number
  /** Currently in progress. */
  live: number
  /** Confirmed, hasn't started yet. */
  upcoming: number
  /** status = pending (awaiting payment). */
  unpaid: number
}

export type AdminTodayWeekPoint = {
  date: string
  count: number
  /** True for the centre column (today). */
  isToday: boolean
}

export type AdminTodayData = {
  /** Venue-local calendar date, YYYY-MM-DD. */
  date: string
  /** Venue-local clock time, HH:mm. */
  nowTime: string
  /** Minutes since midnight, venue-local. */
  nowMinutes: number
  bookings: AdminTodayBooking[]
  stats: AdminTodayStats
  /** Seven days, today at index 3 (the prototype's −3…+3 window). */
  week: AdminTodayWeekPoint[]
  tableCount: number
}

/** Statuses that dim the tile to `off` in the prototype. */
export const INACTIVE_BOOKING_STATUSES: ReadonlySet<string> = new Set([
  'cancelled',
  'admin_cancelled',
  'expired',
  'refunded',
  'payment_failed',
])

/**
 * Prototype `STATUS` — label + pill tone for every booking status. Shared by
 * the 今日 tiles and the 預約 list so the two can never drift apart.
 */
export const BOOKING_STATUS: Record<string, [string, string]> = {
  confirmed: ['已確認', 'good'],
  pending: ['待付款', 'warn'],
  payment_review: ['付款待審核', 'warn'],
  payment_failed: ['付款失敗', 'bad'],
  expired: ['已過期', 'mute'],
  cancelled: ['已取消', 'mute'],
  admin_cancelled: ['已取消（後台）', 'mute'],
  refunded: ['已退款', 'info'],
}

export function statusOf(status: string): [string, string] {
  return BOOKING_STATUS[status] ?? [status, 'mute']
}

/** "10月7日（三）" — the prototype's `dlabel()`. */
export function dateLabel(iso: string | null): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-').map(Number)
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return iso
  const weekday = ['日', '一', '二', '三', '四', '五', '六'][
    new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  ]
  return `${m}月${d}日（${weekday}）`
}

/** `HK$` + `toLocaleString('en-US')` — the prototype's `money()`. */
export function money(amount: number): string {
  return `HK$${Math.round(amount).toLocaleString('en-US')}`
}

/** HK wall-clock, formatted from the host clock rather than the DB TimeZone. */
export function hkNow(now: Date = new Date()): {
  date: string
  time: string
  minutes: number
} {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Hong_Kong',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now)

  const get = (type: string): string =>
    parts.find((p) => p.type === type)?.value ?? '00'

  // Some engines emit hour "24" for midnight under hour12:false.
  const hour = get('hour') === '24' ? '00' : get('hour')
  const minute = get('minute')
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    time: `${hour}:${minute}`,
    minutes: Number(hour) * 60 + Number(minute),
  }
}

/** Shift a YYYY-MM-DD string by whole days without going through a timezone. */
export function shiftDate(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** "HH:mm" → minutes since midnight. Returns 0 for unparseable input. */
export function minutesOf(hhmm: string | null): number {
  if (!hhmm) return 0
  const [h, m, ...rest] = hhmm.split(':')
  if (rest.length > 0 || h === undefined || m === undefined) return 0
  const hours = Number(h)
  const mins = Number(m)
  if (!Number.isFinite(hours) || !Number.isFinite(mins)) return 0
  return hours * 60 + mins
}

/** Live phase for a confirmed booking, matching the prototype's phase(). */
export function bookingPhase(
  b: AdminTodayBooking,
  nowMinutes: number,
): '進行中' | '未開始' | '已結束' | '' {
  if (b.status !== 'confirmed' || !b.date || !b.startTime) return ''
  const start = minutesOf(b.startTime)
  const end = b.endTime
    ? minutesOf(b.endTime)
    : start + Math.round(b.durationHours * 60)
  if (nowMinutes >= end) return '已結束'
  if (nowMinutes >= start) return '進行中'
  return '未開始'
}
