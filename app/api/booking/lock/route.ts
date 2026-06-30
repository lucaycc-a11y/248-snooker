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
      // Full PostgREST error — code/hint/details pinpoint the cause:
      //   PGRST202 = function find_or_lock_slot(...) not found (migration 0004
      //   not applied / signature drift); 42703 = column missing on `slots`;
      //   42883 = arg type mismatch. Returned to the client so it's visible.
      console.error('find_or_lock_slot_error', {
        message: error.message,
        code: (error as { code?: string }).code,
        details: (error as { details?: string }).details,
        hint: (error as { hint?: string }).hint,
      })
      return NextResponse.json(
        {
          error: 'Could not lock slot',
          detail: error.message,
          code: (error as { code?: string }).code ?? null,
        },
        { status: 500 },
      )
    }
    if (!data?.success) {
      return NextResponse.json(
        { error: 'Slot unavailable', reason: data?.reason ?? 'unavailable' },
        { status: 409 },
      )
    }

    return NextResponse.json({ slotId: data.slot_id, lockedUntil: data.locked_until })
  } catch (err) {
    const e = err as Error
    const msg = e.message
    if (msg.includes('duration') || msg.includes('slotEnd')) {
      return NextResponse.json({ error: msg }, { status: 400 })
    }
    // Full exception incl. stack — this catch-all fires when something throws
    // BEFORE/around the RPC. Prime suspects: getServiceSupabase() throwing
    // (SUPABASE_SERVICE_ROLE_KEY missing → "Service Supabase client requires …"),
    // loadPeriods/resolveTierForUser, or a JSON parse. Detail is returned so the
    // real cause is visible instead of a blank "Internal error".
    console.error('lock_error', { message: msg, stack: e.stack })
    return NextResponse.json({ error: 'Internal error', detail: msg }, { status: 500 })
  }
}
