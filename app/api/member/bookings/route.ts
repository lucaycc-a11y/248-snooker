import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { normalizeBooking } from '@/lib/data/getMember'

// ════════════════════════════════════════════════════════════════════════════
// GET /api/member/bookings
// Returns user's booking history (all statuses)
// ════════════════════════════════════════════════════════════════════════════

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    // Fetch all bookings for user
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) throw error

    const bookings = Array.isArray(data) ? data.map((r: any) => normalizeBooking(r)) : []

    return NextResponse.json({ bookings })
  } catch (error) {
    console.error('[bookings] Error:', error)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
