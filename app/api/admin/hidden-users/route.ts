import { NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { listHiddenUsers, mutateHiddenUsers } from '@/lib/admin/hidden-users'

// Hidden accounts — 系統 → 「隱藏帳戶」. Logic lives in lib/admin/hidden-users.ts
// (shared with the iOS route). Reads: any admin. Mutations: super_admin only.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const admin = await getAdminData()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const r = await listHiddenUsers()
  return NextResponse.json(r.body, { status: r.status })
}

export async function POST(req: Request) {
  const admin = await getAdminData()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body: unknown = await req.json().catch(() => null)
  const r = await mutateHiddenUsers(admin, body)
  return NextResponse.json(r.body, { status: r.status })
}
