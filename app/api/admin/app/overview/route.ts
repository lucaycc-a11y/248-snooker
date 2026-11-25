import { NextResponse } from 'next/server'
import { authenticateAppRequest } from '@/lib/admin/bearer-auth'
import { getAdminToday } from '@/lib/data/getAdminToday'
import { getCurrentAppVersion } from '@/lib/data/getAppVersion'
import { getAdminRevenue } from '@/lib/data/getAdminRevenue'
import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'

// iOS admin home: today's bookings + stats, door device heartbeat, app version.
// Admin only. ?includeTest=true also counts test bookings.
export const dynamic = 'force-dynamic'

const NO_STORE = { 'Cache-Control': 'no-store' }

export async function GET(req: Request) {
  const auth = await authenticateAppRequest(req)
  if (auth.status === 'unauthenticated') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE })
  }
  if (auth.status !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403, headers: NO_STORE })
  }

  const includeTest = new URL(req.url).searchParams.get('includeTest') === 'true'

  const [today, version, door] = await Promise.all([
    getAdminToday({ includeTest }),
    getCurrentAppVersion(),
    getLegacyServiceSupabase()
      .from('device_heartbeat')
      .select('device_id, last_seen, status')
      .eq('device_id', 'main_door')
      .maybeSingle()
      .then((r) => r.data ?? null),
  ])

  // Revenue totals come from the same loader as the web 收入 screen (confirmed bookings, hidden and
  // test accounts excluded unless includeTest) — the app must not add bookings up itself.
  const monthStart = `${today.date.slice(0, 7)}-01`
  const [dayRev, monthRev] = await Promise.all([
    getAdminRevenue({ from: today.date, to: today.date, includeTest, detailPage: 1 }),
    getAdminRevenue({ from: monthStart, to: today.date, includeTest, detailPage: 1 }),
  ])
  const revenue =
    dayRev.error || monthRev.error
      ? null
      : { today: dayRev.totals, month: monthRev.totals, monthFrom: monthStart }

  return NextResponse.json(
    {
      date: today.date,
      nowTime: today.nowTime,
      stats: today.stats,
      tableCount: today.tableCount,
      bookings: today.bookings.filter((b) => b.date === today.date),
      week: today.week,
      revenue,
      door,
      version: version ? { version: version.version, label: version.label, isTest: version.isTest } : null,
      error: today.error,
    },
    { headers: NO_STORE },
  )
}
