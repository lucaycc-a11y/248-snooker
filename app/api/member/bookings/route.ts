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

  // Fetch confirmed bookings only (status = 'confirmed')
  // Exclude test bookings (payment_method = 'test') in production; keep them in UAT/dev
  const isProduction = process.env.NEXT_PUBLIC_APP_ENV === 'production'

  let query = supabase
    .from('bookings')
    .select('id, table_number, date, start_time, duration_hours, total_price, human_code, status, payment_method')
    .eq('user_id', user.id)
    .eq('status', 'confirmed')

  // Exclude test payments in production
  if (isProduction) {
    query = query.neq('payment_method', 'test')
  }

  const { data: bookings, error } = await query.order('date', { ascending: false })

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
