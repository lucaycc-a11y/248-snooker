/**
 * POST /api/admin/bookings/manual-slot-check
 *
 * Check slot availability/lock for manual booking creation.
 * Reuses find_or_lock_slot RPC — locks for 15 min on success.
 * Auth: getAdminData() guard.
 */

import { NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { getServiceSupabase } from '@/lib/supabase/service'
import { calculatePrice } from '@/lib/pricing'
import { loadPeriods, resolveTierForUser, slotBounds } from '@/lib/booking/server'

export const runtime = 'nodejs'

type SlotCheckRequest = {
  date: string
  startHour: number
  duration: number
  tableNumber: 1 | 2
}

export async function POST(req: Request) {
  try {
    const admin = await getAdminData()
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized — admin only' }, { status: 401 })
    }

    const body = await req.json().catch(() => null)
    const { date, startHour, duration, tableNumber } = (body ?? {}) as Partial<SlotCheckRequest>

    if (
      typeof date !== 'string' ||
      typeof startHour !== 'number' ||
      typeof duration !== 'number' ||
      (tableNumber !== 1 && tableNumber !== 2)
    ) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }

    const service = getServiceSupabase()
    const periods = await loadPeriods()

    // Admin uses their own tier for price calculation
    const tier = await resolveTierForUser(admin.userId)
    const { slotStart, slotEnd } = slotBounds(date, startHour, duration)
    const quote = calculatePrice(slotStart, slotEnd, tier, periods)

    const startTime = `${String(startHour).padStart(2, '0')}:00:00`

    // Try to lock the slot
    const { data: lockData, error: lockError } = await service.rpc('find_or_lock_slot', {
      p_user_id: admin.userId,
      p_date: date,
      p_start_time: startTime,
      p_duration_hours: duration,
      p_table_number: tableNumber,
      p_price: quote.total,
      p_lock_minutes: 15,
    })

    if (lockError) {
      console.error('[manual-slot-check] lock_failed', { message: lockError.message })
      return NextResponse.json({ available: false, error: lockError.message })
    }

    if (!lockData?.success) {
      return NextResponse.json({
        available: false,
        error: lockData?.reason ?? 'Slot unavailable',
      })
    }

    return NextResponse.json({
      available: true,
      slotId: lockData.slot_id as string,
      lockedUntil: lockData.locked_until as string,
    })
  } catch (err) {
    console.error('[manual-slot-check] error', err)
    return NextResponse.json({ available: false, error: 'Internal error' }, { status: 500 })
  }
}
