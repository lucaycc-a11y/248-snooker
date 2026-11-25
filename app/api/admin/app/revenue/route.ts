import { NextResponse } from 'next/server'
import { requireAppAdmin, jsonError, NO_STORE } from '@/lib/admin/app-guard'
import { getAdminRevenue } from '@/lib/data/getAdminRevenue'

// GET /api/admin/app/revenue?from=&to=[&paymentMethod=&includeTest=true&detailPage=1]
// Same loader as the web 收入 screen, so the numbers always match.
export const dynamic = 'force-dynamic'

const YMD = /^\d{4}-\d{2}-\d{2}$/

export async function GET(req: Request) {
  const g = await requireAppAdmin(req)
  if (!g.ok) return g.res

  const p = new URL(req.url).searchParams
  const hk = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10)
  const from = p.get('from') ?? `${hk.slice(0, 7)}-01`
  const to = p.get('to') ?? hk
  if (!YMD.test(from) || !YMD.test(to)) return jsonError('Dates must be YYYY-MM-DD')
  const pm = p.get('paymentMethod')
  const pageRaw = Number(p.get('detailPage') ?? '1')

  const result = await getAdminRevenue({
    from,
    to,
    paymentMethod: pm && pm !== 'all' ? pm : null,
    includeTest: p.get('includeTest') === 'true',
    detailPage: Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1,
  })
  if (result.error) return jsonError(result.error, 500)
  return NextResponse.json({ ...result, range: { from, to } }, { headers: NO_STORE })
}
