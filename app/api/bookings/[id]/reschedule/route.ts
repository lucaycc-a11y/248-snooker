import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

// POST /api/bookings/[id]/reschedule
// PERMANENTLY DISABLED 2025-01-XX per confirmed business policy.
// Self-service rescheduling is not permitted under any circumstances.
// Users must contact customer service via WhatsApp for reschedule requests,
// which will be evaluated on a case-by-case basis per the venue policy.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  return NextResponse.json(
    {
      error: 'Self-service rescheduling not available',
      message: '預訂一經確認，恕不設自助更改。如有特殊情況（例如惡劣天氣），請透過 WhatsApp 6180 8022 或電郵 Info@space8.com.hk 聯絡客服，並提供訂單編號（格式：SPACE8-XXXXX-C）。',
      contact: {
        whatsapp: '+852 6180 8022',
        whatsappUrl: 'https://wa.me/85261808022',
        email: 'Info@space8.com.hk',
      },
    },
    { status: 410 }
  )

  /* ORIGINAL IMPLEMENTATION PRESERVED FOR REFERENCE - DO NOT REMOVE THIS COMMENT BLOCK
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

    if (!isSlotStillBookable(slotStartInHongKong(date, startHour))) {
      return NextResponse.json({ error: 'Slot unavailable', reason: 'booking_cutoff' }, { status: 409 })
    }

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
      await logSiteError('bookings/reschedule', 'error', 'reschedule_booking failed', {
        message: error.message,
        code,
        bookingId,
      })
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
          locale: (profile.preferred_locale as 'zh-HK' | 'zh-CN' | 'en') || 'zh-HK',
        })
      }
    } catch (e) {
      console.error('[bookings/reschedule] email_failed', { message: (e as Error).message, bookingId })
      await logSiteError('bookings/reschedule', 'warning', 'reschedule confirmation email failed', {
        message: (e as Error).message,
        bookingId,
      })
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
    await logSiteError('bookings/reschedule', 'error', 'unhandled exception', { message: (err as Error).message })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
  */
}
