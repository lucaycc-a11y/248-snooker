/**
 * Admin Revenue API — the 收入 screen and the Excel export both go through
 * getAdminRevenue so the two cannot disagree.
 *
 * GET /api/admin/revenue
 *   ?from=YYYY-MM-DD&to=YYYY-MM-DD          inclusive, Hong Kong days
 *   &paymentMethod=card                     optional, bookings.payment_method
 *   &includeTest=true                       default false
 *   &includeHidden=true                     default false
 *   &detailPage=2                           paged 預約明細
 *
 * Security: any logged-in admin (getAdminData). Hidden accounts are excluded
 * in the shared loader unless includeHidden=true.
 */

import { NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { getAdminRevenue } from '@/lib/data/getAdminRevenue'

export const dynamic = 'force-dynamic'

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export async function GET(req: Request) {
  try {
    const admin = await getAdminData()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const url = new URL(req.url)
    const toParam = url.searchParams.get('to')
    const fromParam = url.searchParams.get('from')

    // Default range is the current Hong Kong calendar month. Day boundaries are
    // `bookings.date` values, which are already Hong Kong days — no shifting.
    const now = new Date()
    const hkNow = new Date(now.getTime() + 8 * 60 * 60 * 1000)
    const monthStart = `${hkNow.toISOString().slice(0, 7)}-01`
    const to = toParam ?? ymd(hkNow)
    const from = fromParam ?? monthStart

    const paymentMethod = url.searchParams.get('paymentMethod')
    const includeTest = url.searchParams.get('includeTest') === 'true'
    const includeHidden = url.searchParams.get('includeHidden') === 'true'
    const detailPageRaw = Number(url.searchParams.get('detailPage') ?? '1')
    const detailPage = Number.isFinite(detailPageRaw) && detailPageRaw >= 1
      ? Math.floor(detailPageRaw)
      : 1

    const result = await getAdminRevenue({
      from,
      to,
      paymentMethod: paymentMethod && paymentMethod !== 'all' ? paymentMethod : null,
      includeTest,
      includeHidden,
      detailPage,
    })

    if (result.error) {
      // Surface the loader's message with a real status — never an empty 200.
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({ ...result, range: { from, to } })
  } catch (err) {
    console.error('[admin/revenue] GET error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
