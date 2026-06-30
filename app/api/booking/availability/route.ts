import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getDaySlots } from '@/lib/booking/server'
import { rateLimit, clientIp } from '@/lib/rate-limit'

export const runtime = 'nodejs'

// POST /api/booking/availability  { date }
// Returns the day's booked/active-locked slot rows (plus neighbouring days, for
// cross-midnight bookings). The client computes per-hour / per-duration greying
// and the available-table list locally from these — one request per date, no
// extra round-trips while the user spins the time wheels.
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
