import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/service'
import { resolvePilotSession } from '@/lib/pilot/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Tier derived from total_wins (not from users.tier which is the payment tier).
function welcomeTier(totalWins: number): string {
  if (totalWins === 0) return 'new_member'
  if (totalWins < 10) return 'nova'
  if (totalWins < 30) return 'platinum'
  return 'diamond'
}

function timePeriod(endTime: string): 'morning' | 'afternoon' | 'evening' {
  const h = parseInt(endTime.slice(0, 2), 10)
  if (h >= 6 && h < 12) return 'morning'
  if (h >= 12 && h < 16) return 'afternoon'
  return 'evening'
}

function maskPhone(phone: string | null): string | null {
  if (!phone) return null
  // Show first digit and last two digits of local number; mask middle.
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 4) return null
  return `${digits[0]}xxx xx${digits.slice(-2)}`
}

function maskEmail(email: string | null): string | null {
  if (!email) return null
  const at = email.indexOf('@')
  if (at < 1) return null
  return `${email[0]}***@${email.slice(at + 1)}`
}

// GET /api/pilot/booking-status?table_number=1
// Requires Authorization: Bearer {session_token}
// Returns the current or upcoming (within 15 min) confirmed booking for the table.
export async function GET(request: Request) {
  const session = await resolvePilotSession(request.headers.get('authorization'))
  if (!session) return NextResponse.json({ error: 'invalid_session' }, { status: 401 })

  const url = new URL(request.url)
  const tableParam = url.searchParams.get('table_number')
  const tableNumber = tableParam ? parseInt(tableParam, 10) : NaN
  if (!Number.isFinite(tableNumber) || (tableNumber !== 1 && tableNumber !== 2)) {
    return NextResponse.json({ error: 'invalid_table_number' }, { status: 400 })
  }

  const service = getServiceSupabase()

  // HKT today as a date string (UTC+8).
  const nowHkt = new Date(Date.now() + 8 * 60 * 60 * 1000)
  const today = nowHkt.toISOString().slice(0, 10)
  const nowTimeStr = nowHkt.toISOString().slice(11, 19) // HH:MM:SS

  // Match any confirmed booking whose window extends at least 15 min before start
  // through end. That is: start_time - 15min <= now < end_time.
  const { data: booking, error: bookingErr } = await service
    .from('bookings')
    .select('id, human_code, start_time, end_time, table_number, user_id')
    .eq('table_number', tableNumber)
    .eq('date', today)
    .eq('status', 'confirmed')
    .lte('start_time', new Date(Date.now() + 8 * 60 * 60 * 1000 + 15 * 60 * 1000).toISOString().slice(11, 19))
    .gt('end_time', nowTimeStr)
    .order('start_time', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (bookingErr) {
    console.error('[pilot/booking-status] booking lookup failed', bookingErr)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }

  if (!booking) return NextResponse.json({ has_booking: false })

  // Load host profile.
  const { data: host, error: hostErr } = await service
    .from('users')
    .select('id, display_name, total_wins, phone, email')
    .eq('id', booking.user_id)
    .maybeSingle()

  if (hostErr) {
    console.error('[pilot/booking-status] host lookup failed', hostErr)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }

  const totalWins = host?.total_wins ?? 0
  const period = timePeriod(booking.end_time)

  return NextResponse.json({
    has_booking: true,
    booking: {
      id: booking.id,
      human_code: booking.human_code,
      start_time: booking.start_time.slice(0, 5),
      end_time: booking.end_time.slice(0, 5),
      table_number: booking.table_number,
    },
    host: {
      user_id: booking.user_id,
      display_name: host?.display_name ?? null,
      total_wins: totalWins,
      welcome_tier: welcomeTier(totalWins),
      phone_masked: maskPhone(host?.phone ?? null),
      email_masked: maskEmail(host?.email ?? null),
    },
    time_period: period,
  })
}
