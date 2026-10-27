import { getAdminReport } from '@/lib/data/getAdminReport'
import AdminReport from '@/components/admin/AdminReport'

// 每日報告 — one HK day: revenue vs last week, room usage, payments, bookings.
// Auth is enforced by app/admin/(shell)/layout.tsx.

export const dynamic = 'force-dynamic'

type SearchParams = { date?: string | string[] | undefined }

export default async function AdminReportPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams> | SearchParams
}) {
  const params = await searchParams
  const date = Array.isArray(params.date) ? params.date[0] : params.date
  const data = await getAdminReport({ date })
  return <AdminReport data={data} />
}
