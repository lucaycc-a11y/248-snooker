import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/service'

export const runtime = 'nodejs'

/**
 * POST /api/booking/send-reminders
 *
 * Called by pg_cron every 5 minutes. Finds confirmed bookings whose
 * start_time is ~30 minutes from now (25-35 min window) and whose
 * booking_date differs from the booking's creation date (i.e. not
 * same-day bookings), then sends the reminder email.
 *
 * Why 25-35 min window: pg_cron fires every 5 minutes, so a 10-minute
 * window (5 min before + 5 min after the 30-min mark) catches every
 * booking regardless of cron jitter. Each booking is protected by the
 * reminder_email_sent_at IS NULL check, so no double-sends.
 *
 * This endpoint is idempotent and safe to call multiple times.
 */
export async function POST() {
  const supabase = getServiceSupabase()

  try {
    // Find bookings that need reminder emails
    // Criteria:
    // 1. status = 'confirmed'
    // 2. reminder_email_sent_at IS NULL (not yet sent)
    // 3. start_time is 25-35 minutes from now
    // 4. date != created_at date (not same-day booking)
    const { data: bookings, error } = await supabase
      .from('bookings')
      .select('id, date, start_time, created_at, status')
      .eq('status', 'confirmed')
      .is('reminder_email_sent_at', null)
      .gte('start_time', `now() + interval '25 minutes'`)
      .lte('start_time', `now() + interval '35 minutes'`)

    if (error) {
      console.error('[send-reminders] query failed', { message: error.message })
      return NextResponse.json({ error: 'query failed', message: error.message }, { status: 500 })
    }

    if (!bookings || bookings.length === 0) {
      return NextResponse.json({ sent: 0, skipped: 0 })
    }

    // Filter out same-day bookings: only send reminders for bookings whose
    // booking date is different from the day they were created.
    const eligible = bookings.filter((b) => {
      const bookingDate = b.date?.slice(0, 10)
      const createdDate = b.created_at?.slice(0, 10)
      return bookingDate && createdDate && bookingDate !== createdDate
    })

    let sent = 0
    let skipped = 0

    for (const booking of eligible) {
      try {
        const { sendBookingReminder } = await import('@/lib/resend/template-send')
        await sendBookingReminder(booking.id)
        sent++
      } catch (e) {
        console.error('[send-reminders] failed for booking', { bookingId: booking.id, message: (e as Error).message })
        skipped++
      }
    }

    return NextResponse.json({ sent, skipped, total: eligible.length })
  } catch (e) {
    console.error('[send-reminders] unexpected error', { message: (e as Error).message })
    return NextResponse.json({ error: 'unexpected error' }, { status: 500 })
  }
}