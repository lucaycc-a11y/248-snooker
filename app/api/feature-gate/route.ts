import { NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { isV802Visible } from '@/lib/feature/v802'

// Tells the client whether to render the v8.0.2 UI. Never cached: it depends on
// who is asking and on whether the version has been released yet.
export const dynamic = 'force-dynamic'

export async function GET() {
  const admin = await getAdminData().catch(() => null)
  const v802 = await isV802Visible(Boolean(admin))
  return NextResponse.json({ v802 }, { headers: { 'Cache-Control': 'no-store' } })
}
