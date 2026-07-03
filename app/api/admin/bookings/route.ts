import { NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { getAdminBookings } from '@/lib/data/getAdminBookings'
import { getServiceSupabase } from '@/lib/supabase/service'

// Thin wrapper — app/admin/bookings/page.tsx calls getAdminBookings() directly
// for first paint; this route serves BookingTable's client-side re-fetches.

export async function GET(req: Request) {
  const admin = await getAdminData()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const isTestParam = url.searchParams.get('isTest')
  const result = await getAdminBookings({
    page: parseInt(url.searchParams.get('page') ?? '1', 10) || 1,
    status: url.searchParams.get('status'),
    dateFrom: url.searchParams.get('dateFrom'),
    dateTo: url.searchParams.get('dateTo'),
    tableNumber: url.searchParams.get('tableNumber'),
    search: url.searchParams.get('search'),
    isTest: isTestParam === 'true' ? true : isTestParam === 'false' ? false : null,
  })
  return NextResponse.json(result)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// Mark/unmark a booking as a test booking — available to both admin and
// super_admin roles (unlike invite/revoke, per the user's own decision).
export async function PATCH(req: Request) {
  try {
    const admin = await getAdminData()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body: unknown = await req.json().catch(() => null)
    if (!isRecord(body) || typeof body.id !== 'string' || typeof body.is_test !== 'boolean') {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const service = getServiceSupabase()
    const { data: existing } = await service
      .from('bookings')
      .select('id, is_test')
      .eq('id', body.id)
      .maybeSingle()
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { error } = await service.from('bookings').update({ is_test: body.is_test }).eq('id', body.id)
    if (error) {
      console.error('[admin/bookings] mark-test update failed', error)
      return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }

    await service.from('audit_log').insert({
      admin_user_id: admin.userId,
      admin_email: admin.email,
      action: body.is_test ? 'booking_mark_test' : 'booking_unmark_test',
      target_table: 'bookings',
      target_id: body.id,
      before_value: { is_test: (existing as { is_test: boolean }).is_test },
      after_value: { is_test: body.is_test },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[admin/bookings] unexpected error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

