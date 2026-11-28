import { NextResponse } from 'next/server'
import { requireAppAdmin, jsonError, NO_STORE } from '@/lib/admin/app-guard'
import { hkToday, loadAppBookings } from '@/lib/admin/app-bookings'

// GET /api/admin/app/bookings?date=YYYY-MM-DD | ?from=&to= [&status=&includeTest=true&limit=100]
// Defaults to today (Hong Kong). Dates and times are Hong Kong wall-clock.
// Paging: `limit` (max 300) + `offset`; the response has `total` and `nextOffset` (null on the last page).
export const dynamic = 'force-dynamic'

const YMD = /^\d{4}-\d{2}-\d{2}$/

export async function GET(req: Request) {
  const g = await requireAppAdmin(req)
  if (!g.ok) return g.res

  const p = new URL(req.url).searchParams
  const date = p.get('date')
  const from = date ?? p.get('from') ?? hkToday()
  const to = date ?? p.get('to') ?? from
  if (!YMD.test(from) || !YMD.test(to)) return jsonError('Dates must be YYYY-MM-DD')
  const limitRaw = Number(p.get('limit') ?? '100')
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.floor(limitRaw), 1), 300) : 100
  const offsetRaw = Number(p.get('offset') ?? '0')
  const offset = Number.isFinite(offsetRaw) ? Math.max(Math.floor(offsetRaw), 0) : 0

  const result = await loadAppBookings({
    from,
    to,
    includeTest: p.get('includeTest') === 'true',
    status: p.get('status'),
    limit,
    offset,
  })
  if (!result.ok) return jsonError(result.error, 500)

  return NextResponse.json(
    { from, to, total: result.total ?? result.bookings.length, nextOffset: result.nextOffset, bookings: result.bookings },
    { headers: NO_STORE },
  )
}
