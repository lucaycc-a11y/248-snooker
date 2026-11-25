import { NextResponse } from 'next/server'
import { requireAppAdmin, jsonError, NO_STORE } from '@/lib/admin/app-guard'
import { getAdminFollowUps } from '@/lib/data/getAdminFollowUps'

// GET /api/admin/app/follow-ups?days=14 — same loader as the web 跟進名單:
// { unpaid: [...], noBooking: [...], unpaidDays, error }. Hidden accounts are excluded.
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const g = await requireAppAdmin(req)
  if (!g.ok) return g.res
  const daysRaw = parseInt(new URL(req.url).searchParams.get('days') ?? '14', 10)
  const days = Number.isFinite(daysRaw) && daysRaw > 0 ? Math.min(daysRaw, 90) : 14
  const result = await getAdminFollowUps({ unpaidDays: days })
  if (result.error) return jsonError(result.error, 500)
  return NextResponse.json(result, { headers: NO_STORE })
}
