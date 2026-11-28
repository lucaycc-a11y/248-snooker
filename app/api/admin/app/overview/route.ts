import { NextResponse } from 'next/server'
import { authenticateAppRequest } from '@/lib/admin/bearer-auth'
import { getAdminToday } from '@/lib/data/getAdminToday'
import { getCurrentAppVersion } from '@/lib/data/getAppVersion'
import { getAdminRevenue } from '@/lib/data/getAdminRevenue'
import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'
import { loadAppBookings } from '@/lib/admin/app-bookings'

// iOS admin home: today's bookings + stats, door device heartbeat, app version.
// Admin only. ?includeTest=true also counts test bookings.
export const dynamic = 'force-dynamic'

const NO_STORE = { 'Cache-Control': 'no-store' }

/** YYYY-MM-DD plus `days` (Hong Kong calendar days; the input is already a HK date). */
function shiftDay(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

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
  const weekStart = shiftDay(today.date, -6)
  // Today's list and the newest bookings come from the same loader as /bookings, in this same request,
  // so the dashboard (counts, tables in use, recent list) is one consistent snapshot.
  const [todayList, recentList, dayRev, monthRev, weekRev] = await Promise.all([
    loadAppBookings({ from: today.date, to: today.date, includeTest, limit: 300, offset: 0 }),
    loadAppBookings({
      from: shiftDay(today.date, -14),
      to: shiftDay(today.date, 90),
      includeTest,
      limit: 5,
      offset: 0,
      newestFirst: true,
    }),
    getAdminRevenue({ from: today.date, to: today.date, includeTest, detailPage: 1 }),
    getAdminRevenue({ from: monthStart, to: today.date, includeTest, detailPage: 1 }),
    getAdminRevenue({ from: weekStart, to: today.date, includeTest, detailPage: 1 }),
  ])
  const revenue =
    dayRev.error || monthRev.error
      ? null
      : { today: dayRev.totals, month: monthRev.totals, monthFrom: monthStart }

  // Last 7 days (oldest first) from the same request as the headline figures, so the chart and the
  // numbers above it cannot disagree. Today's bar is taken from the day total itself.
  const trend = weekRev.error
    ? null
    : weekRev.daily.map((d) =>
        d.date === today.date && !dayRev.error
          ? { date: d.date, revenue: dayRev.totals.revenue, count: dayRev.totals.bookingCount }
          : { date: d.date, revenue: d.revenue, count: d.count },
      )

  return NextResponse.json(
    {
      date: today.date,
      nowTime: today.nowTime,
      stats: today.stats,
      tableCount: today.tableCount,
      bookings: today.bookings.filter((b) => b.date === today.date),
      week: today.week,
      revenue,
      trend,
      // Full 收入 results for "today" and "month to date" (same shape as /revenue), from this very request.
      revenueToday: dayRev.error ? null : { ...dayRev, range: { from: today.date, to: today.date } },
      revenueMonth: monthRev.error ? null : { ...monthRev, range: { from: monthStart, to: today.date } },
      todayBookings: todayList.ok ? todayList.bookings : null,
      recentBookings: recentList.ok ? recentList.bookings : null,
      door,
      version: version ? { version: version.version, label: version.label, isTest: version.isTest } : null,
      error: today.error,
    },
    { headers: NO_STORE },
  )
}
