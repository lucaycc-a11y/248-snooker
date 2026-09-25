import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

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

  // Fetch all confirmed bookings for this user
  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('id, table_id, date, start_time, duration_hours, price, human_code, status')
    .eq('user_id', user.id)
    .order('date', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    bookings: (bookings ?? []).map((b) => ({
      id: b.id,
      tableId: b.table_id,
      date: b.date,
      startTime: b.start_time,
      durationHours: b.duration_hours,
      price: b.price,
      humanCode: b.human_code,
      status: b.status,
    })),
  })
}
