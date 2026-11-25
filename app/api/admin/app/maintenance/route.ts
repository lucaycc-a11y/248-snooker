import { NextResponse } from 'next/server'
import { requireAppAdmin, readJson, NO_STORE } from '@/lib/admin/app-guard'
import { createBlock, listBlocks } from '@/lib/admin/maintenance-blocks'

// 封枱 — same logic and audit trail as the web 封枱 page.
//   GET  ?date=YYYY-MM-DD (optional) -> { blocks: [{ id, date, start_time, end_time, table_number, reason, created_by }] }
//   POST { date, table_number?: int|null (null = all tables), start_time?, end_time? (together), reason? }
// A block stops customers booking that table/time; confirm in the app before sending.
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const g = await requireAppAdmin(req)
  if (!g.ok) return g.res
  const r = await listBlocks(new URL(req.url).searchParams.get('date'))
  return NextResponse.json(r.body, { status: r.status, headers: NO_STORE })
}

export async function POST(req: Request) {
  const g = await requireAppAdmin(req)
  if (!g.ok) return g.res
  const r = await createBlock({ userId: g.admin.userId, email: g.admin.email }, await readJson(req))
  return NextResponse.json(r.body, { status: r.status, headers: NO_STORE })
}
