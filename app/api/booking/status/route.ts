import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceSupabase } from '@/lib/supabase/service'
import { humanReadableCode } from '@/lib/qr/jwt'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic' // reads auth cookies — never prerender

// GET /api/booking/status?bookingId=...
// Returns the caller's own booking so the confirmation screen can poll until the
// Stripe webhook has flipped it to 'confirmed' and written the QR. Scoped to the
// authenticated user — you can only read your own booking.
export async function GET(req: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const bookingId = new URL(req.url).searchParams.get('bookingId')
    if (!bookingId) {
      return NextResponse.json({ error: 'Missing bookingId' }, { status: 400 })
    }

    const service = getServiceSupabase()
    const columns =
      'id, status, booking_reference, qr_code, date, start_time, end_time, duration_hours, table_number, total_price, payment_method, order_group_id, human_code'
    const { data, error } = await service
      .from('bookings')
      .select(columns)
      .eq('id', bookingId)
      .eq('user_id', user.id) // own booking only
      .eq('status', 'confirmed')
      .maybeSingle()
    if (error) {
      console.error('booking_status_error', error.message)
      return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
    if (!data) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // A group checkout (Task 8) shares one order_group_id across N booking
    // rows/tickets. Fetch every sibling so the confirmation screen can render
    // one ticket per booking instead of just the primary one. Single-booking
    // orders (order_group_id null) return a 1-element array — same shape.
    let bookings = [data]
    if (data.order_group_id) {
      const { data: group, error: groupError } = await service
        .from('bookings')
        .select(columns)
        .eq('order_group_id', data.order_group_id)
        .eq('user_id', user.id)
        .order('date', { ascending: true })
        .order('start_time', { ascending: true })
      if (groupError) {
        console.error('booking_status_group_error', groupError.message)
      } else if (group && group.length > 0) {
        bookings = group
      }
    }

    // Fetch member_code from users — it's the universal QR identifier, not stored on bookings.
    const { data: userData } = await service
      .from('users')
      .select('member_code, display_name')
      .eq('id', user.id)
      .maybeSingle()
    const profile = userData as { member_code?: string | null; display_name?: string | null } | null
    const member_code: string = profile?.member_code ?? user.id
    const holder_name = profile?.display_name ?? null

    // Prefer the stored human_code (fixed at insert time); fall back to
    // computing it for rows that predate the column.
    const withHumanCode = (b: typeof data) => ({
      ...b,
      human_code: (b as { human_code?: string | null }).human_code ?? humanReadableCode(String(b.id)),
      member_code,
      holder_name,
    })

    return NextResponse.json({ booking: withHumanCode(data), bookings: bookings.map(withHumanCode) })
  } catch (err) {
    console.error('booking_status_error', (err as Error).message)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
