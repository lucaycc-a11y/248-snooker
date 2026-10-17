/**
 * POST /api/admin/bookings/[id]/weather-reschedule
 *
 * Admin-only: move an existing booking to a new slot after a customer
 * requested a weather reschedule over WhatsApp.
 *
 * The mockup enforces a WhatsApp-request note on every reschedule — that is
 * the evidence the customer actually asked for it, so it is mandatory here.
 *
 * Slot availability reuses `find_or_lock_slot` (same RPC as manual-slot-check):
 * if the target slot is free the RPC holds it, then the booking row is moved.
 *
 * Auth: getAdminData() guard.
 */

import { NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'
import { num, str } from '@/lib/data/adminReadHelpers'
import { withAdminSecurity } from '@/lib/security/admin-wrapper'

export const runtime = 'nodejs'

type WeatherRescheduleRequest = {
  /** Evidence the the customer asked for the change. Required. */
  whatsappNote: string
  date: string
  startHour: number
  durationHours: number
  tableNumber: 1 | 2
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

async function handleWeatherReschedule(
  req: Request,
  adminUser: { id: string; email?: string },
  context?: { params: Record<string, string> }
) {
  try {
    void adminUser
    const admin = await getAdminData()
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized — admin only' }, { status: 401 })
    }

    const bookingId = context?.params?.id
    if (!bookingId || typeof bookingId !== 'string') {
      return NextResponse.json({ error: 'Invalid booking ID' }, { status: 400 })
    }

    const body = await req.json().catch(() => null)
    const { whatsappNote, date, startHour, durationHours, tableNumber } =
      (body ?? {}) as Partial<WeatherRescheduleRequest>

    if (!whatsappNote || typeof whatsappNote !== 'string' || whatsappNote.trim().length === 0) {
      return NextResponse.json(
        { error: '必須填寫客戶 WhatsApp 要求紀錄' },
        { status: 400 },
      )
    }

    if (
      typeof date !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      typeof startHour !== 'number' ||
      !Number.isInteger(startHour) ||
      startHour < 0 ||
      startHour > 23 ||
      typeof durationHours !== 'number' ||
      !Number.isInteger(durationHours) ||
      durationHours < 1 ||
      (tableNumber !== 1 && tableNumber !== 2)
    ) {
      return NextResponse.json({ error: 'Invalid slot parameters' }, { status: 400 })
    }

    const service = getLegacyServiceSupabase()

    const { data: booking, error: fetchErr } = await service
      .from('bookings')
      .select('id, user_id, status, date, start_time, end_time, table_number, duration_hours, human_code')
      .eq('id', bookingId)
      .single()

    if (fetchErr || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    const status = str(booking as Record<string, unknown>, ['status'])
    if (status === 'cancelled' || status === 'admin_cancelled') {
      return NextResponse.json({ error: 'Cannot reschedule a cancelled booking' }, { status: 400 })
    }

    const startTime = `${pad2(startHour)}:00:00`
    const endHour = startHour + durationHours
    const endTime = `${pad2(endHour)}:00:00`

    // ── Reserve the target slot ────────────────────────────────────────
    // find_or_lock_slot refuses an occupied slot and holds a free one for
    // 15 minutes — long enough to move the booking row.
    const { data: lockData, error: lockError } = await service.rpc('find_or_lock_slot', {
      p_user_id: str(booking as Record<string, unknown>, ['user_id']) ?? admin.userId,
      p_date: date,
      p_start_time: startTime,
      p_duration_hours: durationHours,
      p_table_number: tableNumber,
      p_price: num(booking as Record<string, unknown>, ['total_price'], 0),
      p_lock_minutes: 15,
    })

    if (lockError) {
      console.error('[weather-reschedule] lock_failed', { bookingId, message: lockError.message })
      return NextResponse.json({ error: lockError.message }, { status: 409 })
    }

    if (!lockData?.success) {
      return NextResponse.json(
        { error: lockData?.reason ?? '時段已被預約' },
        { status: 409 },
      )
    }

    // ── Move the booking ───────────────────────────────────────────────
    const { error: updateErr } = await service
      .from('bookings')
      .update({
        date,
        start_time: startTime,
        end_time: endTime,
        duration_hours: durationHours,
        table_number: tableNumber,
      })
      .eq('id', bookingId)

    if (updateErr) {
      console.error('[weather-reschedule] update_failed', {
        bookingId,
        message: updateErr.message,
      })
      return NextResponse.json({ error: 'Failed to reschedule booking' }, { status: 500 })
    }

    // ── Audit ─────────────────────────────────────────────────────────
    try {
      await service.from('admin_action_log').insert({
        admin_id: admin.userId,
        admin_email: admin.email,
        action_type: 'booking_weather_reschedule',
        target_table: 'bookings',
        target_id: bookingId,
        before_jsonb: {
          date: booking.date,
          start_time: booking.start_time,
          end_time: booking.end_time,
          table_number: booking.table_number,
          duration_hours: booking.duration_hours,
        },
        after_jsonb: {
          date,
          start_time: startTime,
          end_time: endTime,
          table_number: tableNumber,
          duration_hours: durationHours,
          whatsapp_note: whatsappNote.trim(),
        },
        risk_level: 'medium',
        confirmed_by: admin.userId,
      })
    } catch (logErr) {
      console.warn('[weather-reschedule] audit_log_write_failed', {
        bookingId,
        message: (logErr as Error).message,
      })
    }

    console.log('[weather-reschedule] success', {
      bookingId,
      adminId: admin.userId,
      from: { date: booking.date, start: booking.start_time, table: booking.table_number },
      to: { date, start: startTime, table: tableNumber },
    })

    return NextResponse.json({
      success: true,
      bookingId,
      slot: {
        date,
        startTime,
        endTime,
        tableNumber,
        durationHours,
      },
    })
  } catch (err) {
    const e = err as Error
    console.error('[weather-reschedule] error', { message: e.message, stack: e.stack })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export const POST = withAdminSecurity(handleWeatherReschedule, {
  rateLimit: {
    bucket: 'admin_booking_weather_reschedule',
    max: 20,
    windowSeconds: 60,
  },
})
