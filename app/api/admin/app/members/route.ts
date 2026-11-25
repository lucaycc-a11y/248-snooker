import { NextResponse } from 'next/server'
import { requireAppAdmin, jsonError, NO_STORE } from '@/lib/admin/app-guard'
import { getAdminMembers } from '@/lib/data/getAdminMembers'

// GET /api/admin/app/members?search=&page=1&includeHidden=true
// Same loader as the web 會員 screen: hidden accounts are excluded unless includeHidden=true.
// `error` non-null means the list is NOT a real empty result.
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const g = await requireAppAdmin(req)
  if (!g.ok) return g.res
  const p = new URL(req.url).searchParams
  const pageRaw = Number(p.get('page') ?? '1')
  const result = await getAdminMembers({
    page: Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1,
    search: p.get('search'),
    includeHidden: p.get('includeHidden') === 'true',
  })
  if (result.error) return jsonError(result.error, 500)
  return NextResponse.json(result, { headers: NO_STORE })
}
