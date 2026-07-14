import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/service'
import { rateLimit, clientIp } from '@/lib/rate-limit'

export const runtime = 'nodejs'

const MONTH_RE = /^\d{4}-\d{2}$/

// POST /api/booking/available-dates  { month: 'YYYY-MM' }
// Returns dates in that month where every table/hour is booked or actively
// locked, so the /book calendar can grey them out up front. Aggregate-only,
// no PII — no auth required, but still rate-limited per IP against scraping.
export async function POST(req: Request) {
  try {
    const allowed = await rateLimit('booking_available_dates', `ip:${clientIp(req)}`, 20, 60)
    if (!allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const body = await req.json().catch(() => null)
    const month = body?.month
    if (typeof month !== 'string' || !MONTH_RE.test(month)) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }

    const service = getServiceSupabase()
    const { data, error } = await service.rpc('get_fully_booked_dates', { p_month: `${month}-01` })
    if (error) {
      console.error('available_dates_error', error.message)
      return NextResponse.json({ fullyBookedDates: [] }) // fail open
    }

    const fullyBookedDates = (data ?? []) as string[]
    return NextResponse.json({ fullyBookedDates })
  } catch (err) {
    console.error('available_dates_error', (err as Error).message)
    return NextResponse.json({ fullyBookedDates: [] })
  }
}
