import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceSupabase } from '@/lib/supabase/service'
import { calculatePrice } from '@/lib/pricing'
import { loadPeriods, resolveTierForUser, slotBounds } from '@/lib/booking/server'
import { rateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'

// POST /api/booking/lock
// Locks the chosen table for a date+time by calling find_or_lock_slot(), which
// finds-or-creates the slots row (slots starts empty — Option B). The price is
// computed SERVER-SIDE here and passed in, so pricing logic stays in lib/pricing.
// Returns { slotId, lockedUntil } or 409 if the table was taken in a race.
export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const allowed = await rateLimit('booking_lock', `user:${user.id}`, 20, 60)
    if (!allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const body = await req.json().catch(() => null)
    const date = body?.date
    const startHour = body?.startHour
    const duration = body?.duration
    const tableNumber = body?.tableNumber
    if (
      typeof date !== 'string' ||
      typeof startHour !== 'number' ||
      typeof duration !== 'number' ||
      (tableNumber !== 1 && tableNumber !== 2)
    ) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }

    // Authoritative price from the requested window + the member's tier.
    const periods = await loadPeriods()
    const tier = await resolveTierForUser(user.id)
    const { slotStart, slotEnd } = slotBounds(date, startHour, duration)
    const quote = calculatePrice(slotStart, slotEnd, tier, periods)

    const startTime = `${String(startHour).padStart(2, '0')}:00:00`
    const service = getServiceSupabase()
    const { data, error } = await service.rpc('find_or_lock_slot', {
      p_user_id: user.id,
      p_date: date,
      p_start_time: startTime,
      p_duration_hours: duration,
      p_table_number: tableNumber,
      p_price: quote.total,
      p_lock_minutes: 15,
    })
    if (error) {
      console.error('find_or_lock_slot_error', error.message)
      return NextResponse.json({ error: 'Could not lock slot' }, { status: 500 })
    }
    if (!data?.success) {
      return NextResponse.json(
        { error: 'Slot unavailable', reason: data?.reason ?? 'unavailable' },
        { status: 409 },
      )
    }

    return NextResponse.json({ slotId: data.slot_id, lockedUntil: data.locked_until })
  } catch (err) {
    const msg = (err as Error).message
    if (msg.includes('duration') || msg.includes('slotEnd')) {
      return NextResponse.json({ error: msg }, { status: 400 })
    }
    console.error('lock_error', msg)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
