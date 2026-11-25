/**
 * Admin maintenance_log API — delete a booking block (logic in lib/admin/maintenance-blocks.ts).
 */

import { NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { deleteBlock } from '@/lib/admin/maintenance-blocks'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function DELETE(_req: Request, ctx: Ctx) {
  const admin = await getAdminData()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params
  const r = await deleteBlock(admin, id)
  return NextResponse.json(r.body, { status: r.status })
}
