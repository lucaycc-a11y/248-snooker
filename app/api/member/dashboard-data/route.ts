import { NextResponse } from 'next/server'
import { getMemberDashboardData } from '@/lib/data/getMemberRedesign'

// ════════════════════════════════════════════════════════════════════════════
// GET /api/member/dashboard-data
// Returns complete member dashboard data for client-side refresh
// ════════════════════════════════════════════════════════════════════════════

export async function GET() {
  try {
    const data = await getMemberDashboardData()

    if (!data) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('[dashboard-data] Error:', error)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
