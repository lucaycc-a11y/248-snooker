import { NextResponse } from 'next/server'
import { requireAppAdmin, NO_STORE } from '@/lib/admin/app-guard'
import { listHiddenUsers, mutateHiddenUsers } from '@/lib/admin/hidden-users'

// Hidden accounts for the iOS app — identical rules and data to the web 隱藏帳戶 page.
//   GET   any admin  -> { success, hidden: [{ userId, email, displayName, memberCode, reason, createdAt }] }
//   POST  super_admin only (403 otherwise), audited:
//     { action: "add", userId, reason }          reason >= 5 chars
//     { action: "remove", userId, reason }
//     { action: "add_all_admins", reason }
// Find a userId to hide with GET /api/admin/app/search?q= (members have `hidden`).
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const g = await requireAppAdmin(req)
  if (!g.ok) return g.res
  const r = await listHiddenUsers()
  return NextResponse.json(r.body, { status: r.status, headers: NO_STORE })
}

export async function POST(req: Request) {
  const g = await requireAppAdmin(req)
  if (!g.ok) return g.res
  const body: unknown = await req.json().catch(() => null)
  const r = await mutateHiddenUsers(g.admin, body)
  return NextResponse.json(r.body, { status: r.status, headers: NO_STORE })
}
