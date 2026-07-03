import { NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { getAdminStats, getLiveOccupancy } from '@/lib/data/getAdminStats'

// Thin wrapper around lib/data/getAdminStats.ts — the dashboard page (Server
// Component) calls those functions directly to avoid a same-origin round
// trip; this route exists for the client-side live-occupancy poll
// (components/admin/LiveOccupancy.tsx).

export async function GET() {
  const admin = await getAdminData()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [stats, occupancy] = await Promise.all([getAdminStats(), getLiveOccupancy()])
  return NextResponse.json({ stats, occupancy })
}
