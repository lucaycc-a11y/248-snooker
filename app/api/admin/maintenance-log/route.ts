/**
 * Admin maintenance_log API — per-table booking blocks (logic in lib/admin/maintenance-blocks.ts,
 * shared with the iOS API).
 *
 * GET: list blocks (optionally filtered by date).
 * POST: create a block. `table_number: null` means all tables.
 */

import { NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { createBlock, listBlocks } from '@/lib/admin/maintenance-blocks'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const admin = await getAdminData()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const r = await listBlocks(new URL(req.url).searchParams.get('date'))
  return NextResponse.json(r.body, { status: r.status })
}

export async function POST(req: Request) {
  const admin = await getAdminData()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body: unknown = await req.json().catch(() => null)
  const r = await createBlock(admin, body)
  return NextResponse.json(r.body, { status: r.status })
}
