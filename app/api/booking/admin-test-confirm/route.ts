import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { getServiceSupabase } from '@/lib/supabase/service'
import { getAdminData } from '@/lib/data/getAdmin'
import { calculatePrice } from '@/lib/pricing'
import { loadPeriods, resolveTierForUser, slotBounds, periodForStart } from '@/lib/booking/server'
import { humanReadableCode } from '@/lib/qr/jwt'

export const runtime = 'nodejs'

// GET /api/booking/admin-test-confirm — check if the current user is an admin
export async function GET() {
  const admin = await getAdminData()
  return NextResponse.json({ isAdmin: !!admin })
}

// POST /api/booking/admin-test-confirm
// Admin-only: locks the slot, creates a pending booking, then calls confirm_booking
// RPC directly with payment_method='test', bypassing Stripe entirely.
// Body: same as /api/booking/lock — { date, startHour, duration, tableNumber }
//       or { blocks: [{ date, startHour, duration, tableNumber }, ...] }
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

export async function POST(req: Request) {
  try {
    // ── Admin gate ──────────────────────────────────────────────────────
    const admin = await getAdminData()
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized — admin only' }, { status: 401 })
    }

    const body = await req.json().catch(() => null)
    const blocks: Block[] = Array.isArray(body?.blocks)
      ? (body.blocks as unknown[]).filter(isValidBlock)
      : body?.date && typeof body.startHour === 'number' && typeof body.duration === 'number'
        ? [{ date: body.date, startHour: body.startHour, duration: body.duration, tableNumber: body.tableNumber as 1 | 2 }]
        : []

    if (blocks.length === 0) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }

    console.log('[admin-test-confirm] attempt', { userId: admin.userId, blocks: blocks.length })

    const service = getServiceSupabase()
    const periods = await loadPeriods()
    const tier = await resolveTierForUser(admin.userId)
    const orderGroupId = blocks.length > 1 ? randomUUID() : null
    const bookingIds: string[] = []

    for (const block of blocks) {
      const { slotStart, slotEnd } = slotBounds(block.date, block.startHour, block.duration)
      const quote = calculatePrice(slotStart, slotEnd, tier, periods)
      if (quote.amountInCents <= 0) {
        return NextResponse.json({ error: 'Zero-amount bookings are not supported' }, { status: 400 })
      }

      // Lock the slot
      const startTime = `${String(block.startHour).padStart(2, '0')}:00:00`
      const { data: lockData, error: lockError } = await service.rpc('find_or_lock_slot', {
        p_user_id: admin.userId,
        p_date: block.date,
        p_start_time: startTime,
        p_duration_hours: block.duration,
        p_table_number: block.tableNumber,
        p_price: quote.total,
        p_lock_minutes: 15,
      })
      if (lockError || !lockData?.success) {
        console.error('[admin-test-confirm] lock_failed', { message: lockError?.message, block })
        return NextResponse.json({ error: 'Could not lock slot', detail: lockError?.message }, { status: 409 })
      }

      const slotId = lockData.slot_id as string
      const period = periodForStart(
        block.startHour,
        slotStart.getDay() === 0 || slotStart.getDay() === 6,
        periods,
      )
      const endHour = block.startHour + block.duration
      const endTime = `${String(endHour % 24).padStart(2, '0')}:00:00`

      // Create pending booking
      const newId = randomUUID()
      const { data: booking, error: insErr } = await service
        .from('bookings')
        .insert({
          id: newId,
          user_id: admin.userId,
          slot_id: slotId,
          date: block.date,
          start_time: startTime,
          end_time: endTime,
          duration_hours: block.duration,
          period,
          total_price: quote.total,
          status: 'pending',
          table_number: block.tableNumber,
          is_free_booking: false,
          order_group_id: orderGroupId,
          human_code: humanReadableCode(newId),
        })
        .select('id')
        .single()
      if (insErr || !booking) {
        console.error('[admin-test-confirm] insert_failed', { message: insErr?.message })
        return NextResponse.json({ error: 'Could not create booking' }, { status: 500 })
      }

      bookingIds.push(booking.id)
    }

    // Confirm every booking via the same RPC the Stripe webhook uses
    for (const bookingId of bookingIds) {
      const humanCode = humanReadableCode(bookingId)
      const { data: confirmResult, error: confirmError } = await service.rpc('confirm_booking', {
        p_booking_id: bookingId,
        p_payment_intent_id: `test_${randomUUID()}`,
        p_payment_method: 'test',
        p_qr_code: humanCode,
        p_event_id: null,
      })
      if (confirmError) {
        console.error('[admin-test-confirm] confirm_failed', { bookingId, message: confirmError.message })
        return NextResponse.json({ error: 'Confirm failed', detail: confirmError.message }, { status: 500 })
      }
      const result = confirmResult as { success?: boolean; reason?: string }
      if (result?.success === false) {
        return NextResponse.json({ error: 'Confirm rejected', detail: result.reason }, { status: 500 })
      }
    }

    // Fetch the confirmed bookings for the response
    const columns = 'id, status, booking_reference, date, start_time, end_time, duration_hours, table_number, total_price, payment_method, order_group_id, human_code'
    const { data: bookings } = await service
      .from('bookings')
      .select(columns)
      .in('id', bookingIds)

    console.log('[admin-test-confirm] success', { userId: admin.userId, bookingIds, count: bookings?.length })

    return NextResponse.json({
      success: true,
      bookings,
      primaryBookingId: bookingIds[0],
    })
  } catch (err) {
    const e = err as Error
    console.error('[admin-test-confirm] error', { message: e.message, stack: e.stack })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}