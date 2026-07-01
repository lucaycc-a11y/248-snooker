import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { createClient } from '@/lib/supabase/server'
import { getServiceSupabase } from '@/lib/supabase/service'
import { calculatePrice } from '@/lib/pricing'
import { loadPeriods, resolveTierForUser, slotBounds } from '@/lib/booking/server'
import { rateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'

// A single non-contiguous booking may not exceed this many blocks — a sane cap
// so one request can't lock the whole board.
const MAX_BLOCKS = 6

type Block = { date: string; startHour: number; duration: number; tableNumber: 1 | 2 }

function isValidBlock(b: unknown): b is Block {
  if (typeof b !== 'object' || b === null) return false
  const x = b as Record<string, unknown>
  return (
    typeof x.date === 'string' &&
    typeof x.startHour === 'number' &&
    typeof x.duration === 'number' &&
    (x.tableNumber === 1 || x.tableNumber === 2)
  )
}

// POST /api/booking/lock
// Single form:  { date, startHour, duration, tableNumber }
//   → find_or_lock_slot(); returns { slotId, lockedUntil }.
// Multi form:   { blocks: [{ date, startHour, duration, tableNumber }, ...] }
//   → find_or_lock_slots() locks all blocks atomically (all-or-nothing);
//     returns { slotIds, orderGroupId, lockedUntil }.
// Price is computed SERVER-SIDE per block, so pricing stays in lib/pricing.
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
    const periods = await loadPeriods()
    const tier = await resolveTierForUser(user.id)
    const service = getServiceSupabase()

    // ── Multi-block (non-contiguous) path ──────────────────────────────
    if (Array.isArray(body?.blocks)) {
      const blocks: unknown[] = body.blocks
      if (blocks.length === 0 || blocks.length > MAX_BLOCKS || !blocks.every(isValidBlock)) {
        return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
      }
      const validBlocks = blocks as Block[]
      // Re-derive each block's price server-side; build the jsonb payload the RPC
      // expects. Never trust any client-supplied amount.
      const pSlots = validBlocks.map((b) => {
        const { slotStart, slotEnd } = slotBounds(b.date, b.startHour, b.duration)
        const quote = calculatePrice(slotStart, slotEnd, tier, periods)
        return {
          date: b.date,
          start_time: `${String(b.startHour).padStart(2, '0')}:00:00`,
          duration_hours: b.duration,
          table_number: b.tableNumber,
          price: quote.total,
        }
      })

      console.log('[booking/lock] multi attempt', { userId: user.id, blocks: pSlots.length })

      const { data, error } = await service.rpc('find_or_lock_slots', {
        p_user_id: user.id,
        p_slots: pSlots,
        p_lock_minutes: 15,
      })
      if (error) {
        // P0001 raised inside the RPC = a block was unavailable or the request
        // contained self-overlapping blocks → whole tx rolled back, nothing locked.
        const code = (error as { code?: string }).code
        const conflict = code === 'P0001' || /slot_unavailable|overlapping_request/.test(error.message)
        console.error('[booking/lock] find_or_lock_slots_error', {
          message: error.message,
          code,
          userId: user.id,
        })
        return NextResponse.json(
          conflict
            ? { error: 'Slot unavailable', reason: 'unavailable' }
            : { error: 'Could not lock slots', detail: error.message, code: code ?? null },
          { status: conflict ? 409 : 500 },
        )
      }
      if (!data?.success) {
        return NextResponse.json({ error: 'Slot unavailable', reason: data?.reason ?? 'unavailable' }, { status: 409 })
      }

      // Mint the group id here (server-authoritative). The client threads it into
      // create-intent, which stamps every booking row with it.
      const orderGroupId = randomUUID()
      console.log('[booking/lock] multi success', {
        userId: user.id,
        slots: (data.slot_ids as string[]).length,
        orderGroupId,
      })
      return NextResponse.json({
        slotIds: data.slot_ids as string[],
        orderGroupId,
        lockedUntil: data.locked_until,
      })
    }

    // ── Single-block path (unchanged behaviour) ────────────────────────
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

    console.log('[booking/lock] attempt', { userId: user.id, tableNumber, date, startHour, duration })

    // Authoritative price from the requested window + the member's tier.
    const { slotStart, slotEnd } = slotBounds(date, startHour, duration)
    const quote = calculatePrice(slotStart, slotEnd, tier, periods)

    const startTime = `${String(startHour).padStart(2, '0')}:00:00`
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
      console.error('[booking/lock] find_or_lock_slot_error', {
        message: error.message,
        code: (error as { code?: string }).code,
        details: (error as { details?: string }).details,
        hint: (error as { hint?: string }).hint,
        userId: user.id,
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
      console.log('[booking/lock] rejected', { userId: user.id, reason: data?.reason ?? 'unavailable' })
      return NextResponse.json(
        { error: 'Slot unavailable', reason: data?.reason ?? 'unavailable' },
        { status: 409 },
      )
    }

    console.log('[booking/lock] success', {
      userId: user.id,
      slotId: data.slot_id,
      lockedUntil: data.locked_until,
    })
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
    console.error('[booking/lock] error', { message: msg, stack: e.stack })
    return NextResponse.json({ error: 'Internal error', detail: msg }, { status: 500 })
  }
}
