import { createClient } from '@/lib/supabase/server'
import { humanReadableCode } from '@/lib/qr/jwt'
import { type Row, num, str, genId } from './adminReadHelpers'

// The member dashboard reads from `users` (known shape from the auth callback)
// plus `bookings` and `points_ledger` (schema unverified). Every related query
// is defensive: any failure (missing table/column, RLS) degrades to an empty
// list rather than throwing, so the dashboard always renders.

export type MemberUser = {
  id: string
  email: string | null
  display_name: string | null
  avatar_url: string | null
  phone: string | null
  points: number
  member_code: string
  created_at: string | null
}

export type MemberBooking = {
  id: string
  date: string | null
  startTime: string | null
  endTime: string | null
  tableId: string | number | null
  durationHours: number
  price: number
  status: string
  reference: string | null
  /** SPACE8-XXXXX-X companion code shown under the QR (see lib/qr/jwt.ts). */
  humanCode: string
  refundAmount: number | null
  refundFee: number | null
  refundedAt: string | null
  rescheduledAt: string | null
  rescheduleCount: number
  cancellationReason: string | null
}

export type PointsEntry = {
  id: string
  date: string | null
  description: string
  delta: number
  category: 'booking' | 'refund' | 'manual'
}

export type MemberData = {
  user: MemberUser
  bookings: MemberBooking[]
  points: PointsEntry[]
  stats: { bookings: number; hours: number }
}

// One ticket's worth of data — mirrors TicketCardProps in
// components/booking/TicketCard.tsx so /member/bookings/[id] can render the
// exact same ticket UI as the post-checkout confirmation screen (Task 11).
export type MemberTicket = {
  date: string
  startHour: number
  duration: number
  tableNumber: number
  bookingRef: string
  /** SPACE8-XXXXX-X companion code shown under the QR — customer-service lookup only, never encoded in QR. */
  humanCode: string
  /** Universal member identifier — the value encoded in every QR code. */
  memberCode: string
  totalPrice: number
  paymentMethod: string | null
}

// 248-XXXXXXXX from a user id — stable, human-readable member number when the
// users row has no explicit member_code column.
function deriveMemberCode(id: string, explicit: string | null): string {
  if (explicit) return explicit
  const clean = id.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
  return `248-${clean.slice(0, 8).padEnd(8, '0')}`
}

// A 'pending' booking whose create-intent call never reached Stripe at all
// (bad/missing API key, thrown exception, etc.) gets no payment_failed
// webhook to stamp it — nothing ever calls release_slot_lock for it, since
// Stripe never knew the payment intent existed. Without this, that row sits
// at 'pending' (shown as "confirmed" by the badge's fallback, previously)
// forever. Treat anything still 'pending' past this age as failed for
// DISPLAY purposes only — doesn't write to the DB, so it can't race a
// legitimate in-flight checkout, and if the webhook does eventually land the
// real status simply takes over.
const STUCK_PENDING_MINUTES = 20

function normalizeBooking(row: Row): MemberBooking {
  const start = str(row, ['start_time', 'startTime', 'starts_at', 'start'])
  const date = str(row, ['date', 'booking_date', 'day']) ?? (start ? start.slice(0, 10) : null)
  const refundAmount = row.refund_amount
  const refundFee = row.refund_fee
  const id = String(row.id ?? genId('booking'))
  const rawStatus = str(row, ['status', 'state']) ?? 'confirmed'
  const createdAt = str(row, ['created_at'])
  const isStuckPending =
    rawStatus === 'pending' &&
    createdAt != null &&
    Date.now() - new Date(createdAt).getTime() > STUCK_PENDING_MINUTES * 60_000
  return {
    id,
    date,
    startTime: start,
    endTime: str(row, ['end_time', 'endTime', 'ends_at', 'end']),
    tableId:
      (row.table_number as string | number) ??
      (row.table_id as string | number) ??
      (row.table as string | number) ??
      null,
    durationHours: num(row, ['duration', 'duration_hours', 'hours'], 0),
    price: num(row, ['total_price', 'price', 'amount', 'total'], 0),
    status: isStuckPending ? 'payment_failed' : rawStatus,
    reference: str(row, ['reference', 'ref', 'booking_ref', 'code']),
    // Prefer the stored code (fixed at insert time); fall back to computing it
    // for rows created before the human_code column existed.
    humanCode: str(row, ['human_code']) ?? humanReadableCode(id),
    refundAmount: typeof refundAmount === 'number' ? refundAmount : null,
    refundFee: typeof refundFee === 'number' ? refundFee : null,
    refundedAt: str(row, ['refunded_at']),
    rescheduledAt: str(row, ['rescheduled_at']),
    rescheduleCount: num(row, ['reschedule_count'], 0),
    cancellationReason: str(row, ['cancellation_reason']),
  }
}

function normalizePoints(row: Row): PointsEntry {
  const delta = num(row, ['delta', 'points', 'amount', 'change'], 0)
  const rawType = str(row, ['type'])
  // A negative 'manual' entry is always a refund reversal (request_booking_refund
  // / refund_booking RPCs insert exactly that shape) — inferable without a new
  // column. Everything else with type='booking' is points earned on a booking;
  // any other positive manual entry (e.g. an admin bonus) is 'manual'.
  const category: PointsEntry['category'] =
    rawType === 'booking' ? 'booking' : delta < 0 ? 'refund' : 'manual'
  return {
    id: String(row.id ?? genId('points')),
    date: str(row, ['created_at', 'date', 'earned_at']),
    description: str(row, ['description', 'reason', 'note', 'type']) ?? '',
    delta,
    category,
  }
}

export async function getMemberData(): Promise<MemberData | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  // Core profile. Fall back to the auth user's metadata if the row is missing.
  let profile: Row = {}
  try {
    const { data } = await supabase.from('users').select('*').eq('id', user.id).maybeSingle()
    if (data) profile = data as Row
  } catch {
    /* fall through to metadata defaults */
  }

  const memberUser: MemberUser = {
    id: user.id,
    email: (profile.email as string) ?? user.email ?? null,
    display_name:
      (profile.display_name as string) ??
      (user.user_metadata?.full_name as string) ??
      (user.email ? user.email.split('@')[0] : null),
    avatar_url: (profile.avatar_url as string) ?? (user.user_metadata?.avatar_url as string) ?? null,
    phone: (profile.phone as string) ?? null,
    points: num(profile, ['points', 'points_balance'], 0),
    member_code: deriveMemberCode(user.id, str(profile, ['member_code', 'member_no'])),
    created_at: (profile.created_at as string) ?? user.created_at ?? null,
  }

  // Bookings (defensive).
  let bookings: MemberBooking[] = []
  try {
    const { data } = await supabase
      .from('bookings')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)
    if (Array.isArray(data)) bookings = data.map((r) => normalizeBooking(r as Row))
  } catch {
    /* table may not exist yet */
  }

  // Points ledger (defensive).
  let points: PointsEntry[] = []
  try {
    const { data } = await supabase
      .from('points_ledger')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)
    if (Array.isArray(data)) points = data.map((r) => normalizePoints(r as Row))
  } catch {
    /* table may not exist yet */
  }

  const stats = {
    bookings: bookings.length,
    hours: bookings.reduce((sum, b) => sum + (b.durationHours || 0), 0),
  }

  return { user: memberUser, bookings, points, stats }
}

// Single booking scoped to the caller's own user_id, shaped for TicketCard
// (Task 11 — /member/bookings/[id] reuses the same ticket UI the post-checkout
// confirmation screen uses). Returns null when unauthenticated, not found, or
// not owned by the caller — the route treats all three as "not found".
export async function getMemberTicket(bookingId: string): Promise<MemberTicket | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('bookings')
    .select(
      'date, start_time, duration_hours, table_number, booking_reference, qr_code, total_price, payment_method, human_code, user_id'
    )
    .eq('id', bookingId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (error || !data) return null

  // Fetch member_code from the users table — it's the universal QR identifier.
  const { data: userData } = await supabase
    .from('users')
    .select('member_code')
    .eq('id', user.id)
    .single()

  const row = data as Row
  const startTime = str(row, ['start_time']) ?? '00:00'
  return {
    date: str(row, ['date']) ?? '',
    startHour: parseInt(startTime.slice(0, 2), 10) || 0,
    duration: num(row, ['duration_hours'], 0),
    tableNumber: num(row, ['table_number'], 0),
    bookingRef: str(row, ['booking_reference']) ?? bookingId,
    // Prefer the stored code; fall back for rows predating the column.
    humanCode: str(row, ['human_code']) ?? humanReadableCode(bookingId),
    memberCode: userData?.member_code ?? user.id,
    totalPrice: num(row, ['total_price'], 0),
    paymentMethod: str(row, ['payment_method']),
  }
}
