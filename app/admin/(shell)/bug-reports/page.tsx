import { getBugReports } from '@/lib/data/getAdminChecks'
import BugReportsClient from '@/components/admin/BugReportsClient'

// 問題回報 — auth is enforced by app/admin/(shell)/layout.tsx.
export const dynamic = 'force-dynamic'

export default async function BugReportsPage() {
  const { rows, error } = await getBugReports()
  return <BugReportsClient rows={rows} loadError={error} />
}
