import { getServiceSupabase } from '@/lib/supabase/service'
import type { Row } from '@/lib/data/adminReadHelpers'

// Member detail data shared by the web page (/admin/members/[id]) and the iOS API.
export async function getMemberDetail(id: string) {
  const service = getServiceSupabase()

  // Parallel fetches for all tab data
  const [userRes, bookingsRes, pointsRes, activityRes, cancellationRes, waivedRes] =
    await Promise.all([
      service
        .from('users')
        .select('id, member_code, email, display_name, phone, tier, points, is_blacklisted, created_at')
        .eq('id', id)
        .maybeSingle(),

      service
        .from('bookings')
        .select('id, human_code, booking_reference, date, status, total_price, table_number')
        .eq('user_id', id)
        .eq('is_test', false)
        .order('date', { ascending: false })
        .limit(50),

      service
        .from('points_ledger')
        .select('id, points, type, note, created_at')
        .eq('user_id', id)
        .order('created_at', { ascending: false })
        .limit(50),

      // Audit rows touching this member — audit_log is the real table.
      service
        .from('audit_log')
        .select('action, before_value, after_value, created_at')
        .eq('target_id', id)
        .order('created_at', { ascending: false })
        .limit(20),

      // Count cancelled bookings for this user
      service
        .from('cancellation_log')
        .select('id, compensation_type', { count: 'exact' })
        .in(
          'booking_id',
          (
            await service
              .from('bookings')
              .select('id')
              .eq('user_id', id)
          ).data?.map((b: Row) => String(b.id)) ?? [],
        ),

      // Count waived fees (compensation_type = 'none')
      service
        .from('cancellation_log')
        .select('id', { count: 'exact' })
        .eq('compensation_type', 'none')
        .in(
          'booking_id',
          (
            await service
              .from('bookings')
              .select('id')
              .eq('user_id', id)
          ).data?.map((b: Row) => String(b.id)) ?? [],
        ),
    ])

  if (!userRes.data) return null

  const user = userRes.data as Row
  const bookings = (bookingsRes.data ?? []) as Row[]
  const pointsLedger = (pointsRes.data ?? []) as Row[]
  const activity = (activityRes.data ?? []) as Row[]
  const totalBookings = bookings.length
  const cancelledBookings = cancellationRes.count ?? 0
  const waivedFees = waivedRes.count ?? 0

  return {
    user,
    bookings,
    pointsLedger,
    activity,
    riskStats: { totalBookings, cancelledBookings, waivedFees },
  }
}
