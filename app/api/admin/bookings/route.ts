import { NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { getAdminBookings } from '@/lib/data/getAdminBookings'

// Thin wrapper — app/admin/bookings/page.tsx calls getAdminBookings() directly
// for first paint; this route serves BookingTable's client-side re-fetches.

export async function GET(req: Request) {
  const admin = await getAdminData()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const result = await getAdminBookings({
    page: parseInt(url.searchParams.get('page') ?? '1', 10) || 1,
    status: url.searchParams.get('status'),
    dateFrom: url.searchParams.get('dateFrom'),
    dateTo: url.searchParams.get('dateTo'),
    tableNumber: url.searchParams.get('tableNumber'),
    search: url.searchParams.get('search'),
  })
  return NextResponse.json(result)
}
