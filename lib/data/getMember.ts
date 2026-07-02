import { createClient } from '@/lib/supabase/server'

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
}

export type MemberData = {
  user: MemberUser
  bookings: MemberBooking[]
  points: PointsEntry[]
  stats: { bookings: number; hours: number; spent: number }
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
  qrData?: string
  totalPrice: number
  paymentMethod: string | null
}

type Row = Record<string, unknown>

function num(row: Row, keys: string[], fallback = 0): number {
  for (const k of keys) {
    const v = row[k]
    if (typeof v === 'number') return v
    if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return Number(v)
  }
  return fallback
}

function str(row: Row, keys: string[]): string | null {
  for (const k of keys) {
    const v = row[k]
    if (typeof v === 'string' && v.trim() !== '') return v
  }
  return null
}

// 248-XXXXXXXX from a user id — stable, human-readable member number when the
// users row has no explicit member_code column.
function deriveMemberCode(id: string, explicit: string | null): string {
  if (explicit) return explicit
  const clean = id.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
  return `248-${clean.slice(0, 8).padEnd(8, '0')}`
}

// Stable-enough fallback id for rows missing one. Avoids relying on
// crypto.randomUUID being present in every runtime.
let idCounter = 0
function genId(prefix: string): string {
  idCounter += 1
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`
}

function normalizeBooking(row: Row): MemberBooking {
  const start = str(row, ['start_time', 'startTime', 'starts_at', 'start'])
  const date = str(row, ['date', 'booking_date', 'day']) ?? (start ? start.slice(0, 10) : null)
  const refundAmount = row.refund_amount
  const refundFee = row.refund_fee
  return {
    id: String(row.id ?? genId('booking')),
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
    status: str(row, ['status', 'state']) ?? 'confirmed',
    reference: str(row, ['reference', 'ref', 'booking_ref', 'code']),
    refundAmount: typeof refundAmount === 'number' ? refundAmount : null,
    refundFee: typeof refundFee === 'number' ? refundFee : null,
    refundedAt: str(row, ['refunded_at']),
    rescheduledAt: str(row, ['rescheduled_at']),
    rescheduleCount: num(row, ['reschedule_count'], 0),
    cancellationReason: str(row, ['cancellation_reason']),
  }
}

function normalizePoints(row: Row): PointsEntry {
  return {
    id: String(row.id ?? genId('points')),
    date: str(row, ['created_at', 'date', 'earned_at']),
    description: str(row, ['description', 'reason', 'note', 'type']) ?? '',
    delta: num(row, ['delta', 'points', 'amount', 'change'], 0),
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
    spent: bookings.reduce((sum, b) => sum + (b.price || 0), 0),
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
      'date, start_time, duration_hours, table_number, booking_reference, qr_code, total_price, payment_method'
    )
    .eq('id', bookingId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (error || !data) return null

  const row = data as Row
  const startTime = str(row, ['start_time']) ?? '00:00'
  return {
    date: str(row, ['date']) ?? '',
    startHour: parseInt(startTime.slice(0, 2), 10) || 0,
    duration: num(row, ['duration_hours'], 0),
    tableNumber: num(row, ['table_number'], 0),
    bookingRef: str(row, ['booking_reference']) ?? bookingId,
    qrData: str(row, ['qr_code']) ?? undefined,
    totalPrice: num(row, ['total_price'], 0),
    paymentMethod: str(row, ['payment_method']),
  }
}
