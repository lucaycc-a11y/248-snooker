import { getAdminHome } from '@/lib/data/getAdminHome'
import { getAdminData } from '@/lib/data/getAdmin'
import AdminHome from '@/components/admin/AdminHome'

// 首頁 — overview, room timetable and things that need attention.
// Auth is enforced by app/admin/(shell)/layout.tsx. Test bookings and hidden
// users are always excluded here; the full lists live on their own pages.

export const dynamic = 'force-dynamic'

type SearchParams = { date?: string | string[] | undefined }

export default async function AdminHomePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams> | SearchParams
}) {
  const params = await searchParams
  const rawDate = Array.isArray(params.date) ? params.date[0] : params.date
  const [data, admin] = await Promise.all([getAdminHome({ date: rawDate }), getAdminData()])

  return <AdminHome data={data} adminName={admin?.displayName ?? null} />
}
