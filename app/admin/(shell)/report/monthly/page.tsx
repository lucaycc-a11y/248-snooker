import { getAdminMonthlyReport } from '@/lib/data/getAdminMonthlyReport'
import MonthlyReport from '@/components/admin/report/MonthlyReport'
import { hkNow } from '@/lib/admin/today'

// 月報 — one HK month with Spark suggestions; printable to PDF. Auth: app/admin/(shell)/layout.tsx.
export const dynamic = 'force-dynamic'

export default async function AdminMonthlyReportPage({ searchParams }: { searchParams: Promise<{ month?: string | string[] }> | { month?: string | string[] } }) {
  const params = await searchParams
  const month = Array.isArray(params.month) ? params.month[0] : params.month
  const data = await getAdminMonthlyReport({ month })
  return <MonthlyReport data={data} thisMonth={hkNow().date.slice(0, 7)} />
}
