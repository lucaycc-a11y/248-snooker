import { getAdminActivity } from '@/lib/data/getAdminActivity'
import AdminActivity from '@/components/admin/AdminActivity'

// 網站記錄 — unified activity timeline + system health checks.
// Auth is enforced by app/admin/(shell)/layout.tsx.

export const dynamic = 'force-dynamic'

type SearchParams = Record<string, string | string[] | undefined>

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

export default async function AdminActivityPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams> | SearchParams
}) {
  const params = await searchParams
  const data = await getAdminActivity({
    filter: first(params.type),
    hours: Number(first(params.hours) ?? 24),
    problemsOnly: first(params.problems) === '1',
  })
  return <AdminActivity data={data} />
}
