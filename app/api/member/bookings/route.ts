import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { MEMBER_VISIBLE_BOOKING_STATUSES } from '@/lib/data/getMember'

// ════════════════════════════════════════════════════════════════════════════
// GET /api/member/bookings — Fetch user's bookings (upcoming + past)
// ════════════════════════════════════════════════════════════════════════════

export async function GET() {
  const supabase = await createClient()

  // SECURITY: Use getUser() not getSession() for auth decisions
  // getSession() reads cookies which can be forged; getUser() validates with auth server
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // All of the member's own real bookings (upcoming + past). No payment_method
  // filter: admin test bookings are the member's own, and neq() would also
  // drop rows whose payment_method IS NULL. See MEMBER_VISIBLE_BOOKING_STATUSES.
  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('id, table_number, date, start_time, duration_hours, total_price, human_code, status, payment_method')
    .eq('user_id', user.id)
    .in('status', [...MEMBER_VISIBLE_BOOKING_STATUSES])
    .order('date', { ascending: false })

  if (error) {
    console.error('[member/bookings] Query failed:', {
      userId: user.id,
      error: error.message,
      code: error.code,
    })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    bookings: (bookings ?? []).map((b) => ({
      id: b.id,
      tableId: b.table_number,
      date: b.date,
      startTime: b.start_time,
      durationHours: b.duration_hours,
      price: b.total_price,
      humanCode: b.human_code,
      status: b.status,
    })),
  })
}
