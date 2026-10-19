import { getAdminData } from '@/lib/data/getAdmin'
import { getAdminFollowUps } from '@/lib/data/getAdminFollowUps'
import FollowUpsClient from '@/components/admin/FollowUpsClient'

export const dynamic = 'force-dynamic'

// 會員 → 「跟進名單」: unpaid checkouts and sign-ups with no booking.
export default async function AdminFollowUpsPage() {
  const admin = await getAdminData()
  if (!admin) return null
  const data = await getAdminFollowUps({ unpaidDays: 14 })
  return <FollowUpsClient initial={data} />
}
