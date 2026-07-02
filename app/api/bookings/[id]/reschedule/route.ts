import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceSupabase } from '@/lib/supabase/service'
import { slotBounds } from '@/lib/booking/server'
import { rateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'

// POST /api/bookings/[id]/reschedule
// Self-serve, free reschedule to a new date/time/table. Must be before the
// booking's current start_time; the new slot must be free. Body:
// { date, startHour, duration, tableNumber } — same shape as /api/booking/lock,
// converted server-side into timestamps via the shared slotBounds() helper so
// the client never constructs a timestamptz itself. No Stripe call (free).
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const allowed = await rateLimit('booking_reschedule', `user:${user.id}`, 10, 60)
    if (!allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const bookingId = params.id
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

    const service = getServiceSupabase()

    const { data: owned } = await service
      .from('bookings')
      .select('id, user_id, date, start_time, end_time')
      .eq('id', bookingId)
      .maybeSingle()
    if (!owned || owned.user_id !== user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const { slotStart, slotEnd } = slotBounds(date, startHour, duration)

    const { data, error } = await service.rpc('reschedule_booking', {
      p_booking_id: bookingId,
      p_new_start: slotStart.toISOString(),
      p_new_end: slotEnd.toISOString(),
      p_new_table_number: tableNumber,
    })
    if (error) {
      const code = (error as { code?: string }).code
      if (code === 'P0001') {
        return NextResponse.json({ error: 'Slot unavailable', reason: 'unavailable' }, { status: 409 })
      }
      console.error('[bookings/reschedule] rpc_error', { message: error.message, code, bookingId })
      return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
    if (!data?.success) {
      return NextResponse.json(
        { error: 'Reschedule not allowed', reason: data?.reason ?? 'not_reschedulable' },
        { status: 400 },
      )
    }

    // Email (non-fatal).
    try {
      const { data: profile } = await service
        .from('users')
        .select('name, preferred_locale')
        .eq('id', user.id)
        .single()

      if (profile?.name) {
        const { sendBookingRescheduledEmail } = await import('@/lib/resend/send')
        await sendBookingRescheduledEmail({
          to: user.email ?? '',
          booking: { id: bookingId, table_number: data.table_number },
          oldDate: owned.date ?? '',
          oldStartTime: owned.start_time ?? '',
          oldEndTime: owned.end_time ?? '',
          newDate: data.date,
          newStartTime: data.start_time,
          newEndTime: data.end_time,
          customerName: profile.name,
          locale: (profile.preferred_locale as 'zh-HK' | 'zh-CN' | 'en' | 'ja') || 'zh-HK',
        })
      }
    } catch (e) {
      console.error('[bookings/reschedule] email_failed', { message: (e as Error).message, bookingId })
    }

    return NextResponse.json({
      success: true,
      bookingId,
      date: data.date,
      startTime: data.start_time,
      endTime: data.end_time,
      tableNumber: data.table_number,
      rescheduleCount: data.reschedule_count,
    })
  } catch (err) {
    console.error('[bookings/reschedule] error', { message: (err as Error).message })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
