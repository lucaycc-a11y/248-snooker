import { NextResponse } from 'next/server'
import { requireAppAdmin, NO_STORE } from '@/lib/admin/app-guard'
import { deleteBlock } from '@/lib/admin/maintenance-blocks'

// DELETE /api/admin/app/maintenance/:id — remove a 封枱 block (audited).
export const dynamic = 'force-dynamic'

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const g = await requireAppAdmin(req)
  if (!g.ok) return g.res
  const r = await deleteBlock({ userId: g.admin.userId, email: g.admin.email }, params.id)
  return NextResponse.json(r.body, { status: r.status, headers: NO_STORE })
}
