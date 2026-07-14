import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { calculatePrice } from '@/lib/pricing'
import { loadPeriods, resolveTierForUser } from '@/lib/booking/server'
import { rateLimit, clientIp } from '@/lib/rate-limit'

export const runtime = 'nodejs'

// POST /api/booking/quote
// Returns a DISPLAY-ONLY price breakdown for a prospective booking. This value is
// NOT authoritative for charging: the amount sent to Stripe is re-derived from the
// locked slot in /api/payment/create-intent. The client must never treat this
// figure as the final charge.
export async function POST(req: Request) {
  try {
    // Caller may be anonymous (the booking UI shows a price before login). When
    // logged in we key the rate limit + tier on the user; otherwise on IP.
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const identifier = user ? `user:${user.id}` : `ip:${clientIp(req)}`
    const allowed = await rateLimit('booking_quote', identifier, user ? 20 : 10, 60)
    if (!allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const body = await req.json().catch(() => null)
    const date = body?.date
    const startHour = body?.startHour
    const duration = body?.duration
    if (
      typeof date !== 'string' ||
      typeof startHour !== 'number' ||
      typeof duration !== 'number'
    ) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }

    // Build local-time slot bounds. `${date}T00:00:00` is parsed in the server's
    // local zone; deployments should run in Asia/Hong_Kong (set TZ) so hour-of-day
    // period resolution matches venue local time.
    const slotStart = new Date(`${date}T00:00:00`)
    if (Number.isNaN(slotStart.getTime())) {
      return NextResponse.json({ error: 'Invalid date' }, { status: 400 })
    }
    slotStart.setHours(startHour, 0, 0, 0)
    const slotEnd = new Date(slotStart)
    slotEnd.setHours(slotEnd.getHours() + duration)

    const periods = await loadPeriods()
    const tier = await resolveTierForUser(user?.id)

    // calculatePrice throws on out-of-range duration → 400 below.
    const quote = calculatePrice(slotStart, slotEnd, tier, periods)

    return NextResponse.json({
      authoritative: false, // display only — re-quoted at intent creation
      ...quote,
    })
  } catch (err) {
    // Domain validation errors (bad duration) surface as 400; everything else 500.
    const msg = (err as Error).message
    if (msg.includes('duration') || msg.includes('slotEnd')) {
      return NextResponse.json({ error: msg }, { status: 400 })
    }
    console.error('quote_error', msg)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
