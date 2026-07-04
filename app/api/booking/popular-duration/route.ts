import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/service'
import { num, type Row } from '@/lib/data/adminReadHelpers'
import { rateLimit, clientIp } from '@/lib/rate-limit'

export const runtime = 'nodejs'

// GET /api/booking/popular-duration
// Public, anonymous-safe: the real mode of confirmed bookings' duration_hours,
// over the last 90 days. Used only to pre-highlight a duration quick-pick chip
// on the slot picker — never to auto-select without the user's own tap. Falls
// back to a 1h default on any query error or if there's no booking history yet
// (new venue), rather than surfacing an error for a non-critical UI hint.
export async function GET(req: Request) {
  const allowed = await rateLimit('popular_duration', `ip:${clientIp(req)}`, 30, 60)
  if (!allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  try {
    const service = getServiceSupabase()
    const since = new Date()
    since.setDate(since.getDate() - 90)

    const { data, error } = await service
      .from('bookings')
      .select('duration_hours')
      .eq('status', 'confirmed')
      .eq('is_test', false)
      .gte('date', since.toISOString().slice(0, 10))

    if (error) throw error

    const rows = (data ?? []) as Row[]
    const counts = new Map<number, number>()
    for (const r of rows) {
      const hours = num(r, ['duration_hours'], 0)
      if (hours <= 0) continue
      counts.set(hours, (counts.get(hours) ?? 0) + 1)
    }

    let popularDuration = 1
    let best = 0
    for (const [hours, count] of counts) {
      if (count > best) {
        best = count
        popularDuration = hours
      }
    }

    return NextResponse.json({ popularDuration, sampleSize: rows.length })
  } catch (err) {
    console.error('popular_duration_error', (err as Error).message)
    return NextResponse.json({ popularDuration: 1, sampleSize: 0 })
  }
}
