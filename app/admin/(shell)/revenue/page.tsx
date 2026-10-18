import { getAdminData } from '@/lib/data/getAdmin'
import RevenuePageClient from '@/components/admin/RevenuePageClient'

export const dynamic = 'force-dynamic'

// 預約 → 「收入」. Admin and super_admin can both see it. The screen and the
// Excel export read the same loader (lib/data/getAdminRevenue.ts), so the two
// cannot disagree. /admin/sales-report stays mounted as a deep link and is
// deliberately not in navigation — this is the one money entry.
export default async function AdminRevenuePage() {
  const admin = await getAdminData()
  if (!admin) return null

  return <RevenuePageClient />
}
