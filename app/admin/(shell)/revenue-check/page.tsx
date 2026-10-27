import { getChecksOverview } from '@/lib/data/getAdminChecks'
import RevenueCheckClient from '@/components/admin/RevenueCheckClient'

// 收入核對 — auth is enforced by app/admin/(shell)/layout.tsx.
export const dynamic = 'force-dynamic'

export default async function RevenueCheckPage() {
  const { runs, alerts, error } = await getChecksOverview()
  return <RevenueCheckClient runs={runs} alerts={alerts} loadError={error} />
}
