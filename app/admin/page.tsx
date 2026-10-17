import { getAdminToday } from '@/lib/data/getAdminToday'
import TodayDashboard from '@/components/admin/TodayDashboard'

// 今日 — the venue's live day, as `space8-admin.html` vToday.
// Auth is enforced by app/admin/layout.tsx (getAdminData).

export const dynamic = 'force-dynamic'

type SearchParams = { test?: string | string[] | undefined }

export default async function AdminTodayPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const includeTest = searchParams.test === '1'
  const data = await getAdminToday({ includeTest })

  return <TodayDashboard data={data} includeTest={includeTest} />
}
