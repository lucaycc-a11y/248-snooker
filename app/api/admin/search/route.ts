import { NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { getServiceSupabase } from '@/lib/supabase/service'

/**
 * Admin global search — §4.
 *
 * GET ?q=<query> — searches across bookings, users, payments, and coupons.
 * Returns grouped results with max 3 per section.
 * Zero results triggers a client-side AI fallback.
 */

const MAX_PER_SECTION = 3

export async function GET(req: Request) {
  try {
    const admin = await getAdminData()
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q')?.trim()

    if (!q || q.length < 2) {
      return NextResponse.json({ bookings: [], users: [], payments: [] })
    }

    const service = getServiceSupabase()

    // ── Parallel searches ──────────────────────────────────────────────────
    const [bookingsRes, usersRes, paymentsRes] = await Promise.all([
      // Bookings: search by human_code, booking_reference, email, phone
      service
        .from('bookings')
        .select('id, human_code, booking_reference, user_email, user_name, table_number, date, start_time, end_time, total_price, status')
        .or(`human_code.ilike.%${q}%,booking_reference.ilike.%${q}%,user_email.ilike.%${q}%,user_name.ilike.%${q}%`)
        .order('created_at', { ascending: false })
        .limit(MAX_PER_SECTION),

      // Users: search by email, phone, member_code, display_name
      service
        .from('users')
        .select('id, email, display_name, phone, member_code, tier, last_active_at')
        .or(`email.ilike.%${q}%,phone.ilike.%${q}%,member_code.ilike.%${q}%,display_name.ilike.%${q}%`)
        .order('created_at', { ascending: false })
        .limit(MAX_PER_SECTION),

      // Payments: search by payment attempt ID or provider order number
      service
        .from('payment_attempts')
        .select('id, booking_id, amount, status, provider_order_no, created_at')
        .or(`id.ilike.%${q}%,provider_order_no.ilike.%${q}%`)
        .order('created_at', { ascending: false })
        .limit(MAX_PER_SECTION),
    ])

    const bookings = bookingsRes.data ?? []
    const users = usersRes.data ?? []
    const payments = paymentsRes.data ?? []

    // If zero results, return empty — client will trigger AI fallback
    const totalResults = bookings.length + users.length + payments.length

    return NextResponse.json({
      bookings,
      users,
      payments,
      totalResults,
      query: q,
    })
  } catch (err) {
    console.error('[admin/search] GET error', err)
    return NextResponse.json(
      { error: 'Internal error', bookings: [], users: [], payments: [] },
      { status: 500 }
    )
  }
}
