import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getDaySlots, getRangeSlots } from '@/lib/booking/server'
import { rateLimit, clientIp } from '@/lib/rate-limit'

export const runtime = 'nodejs'

// Prefetch cap: a single range request covers at most this many days so a caller
// can't ask for an unbounded scan. The client prefetches today + 7 (8 total).
const MAX_RANGE_DAYS = 14

// POST /api/booking/availability  { date }  OR  { startDate, days }
// Returns booked/active-locked slot rows (plus neighbouring days, for
// cross-midnight bookings). The client computes per-hour / per-duration greying
// and the available-table list locally from these. The { startDate, days } form
// prefetches a week in one round-trip so switching dates needs no further calls.
export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const identifier = user ? `user:${user.id}` : `ip:${clientIp(req)}`
    const allowed = await rateLimit('booking_availability', identifier, user ? 30 : 15, 60)
    if (!allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const body = await req.json().catch(() => null)

    // Range form (prefetch): { startDate, days }
    if (typeof body?.startDate === 'string' && typeof body?.days === 'number') {
      const days = Math.min(Math.max(1, Math.floor(body.days)), MAX_RANGE_DAYS)
      const slots = await getRangeSlots(body.startDate, days)
      return NextResponse.json({ slots })
    }

    // Single-date form (back-compat / out-of-range on-demand fetch)
    const date = body?.date
    if (typeof date !== 'string') {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }

    const slots = await getDaySlots(date)
    return NextResponse.json({ slots })
  } catch (err) {
    console.error('availability_error', (err as Error).message)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
