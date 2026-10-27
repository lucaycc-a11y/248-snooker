import { getAdminLookup } from '@/lib/data/getAdminLookup'
import AdminLookup from '@/components/admin/AdminLookup'

// 客戶查詢 — find a member or booking and see its full history.
// Auth is enforced by app/admin/(shell)/layout.tsx.

export const dynamic = 'force-dynamic'

type SearchParams = Record<string, string | string[] | undefined>

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function AdminLookupPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams> | SearchParams
}) {
  const params = await searchParams
  const user = first(params.user)
  const booking = first(params.booking)
  const data = await getAdminLookup({
    q: first(params.q),
    user: user && UUID.test(user) ? user : undefined,
    booking: booking && UUID.test(booking) ? booking : undefined,
  })
  return <AdminLookup data={data} />
}
