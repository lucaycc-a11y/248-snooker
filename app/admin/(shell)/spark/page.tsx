import { getAdminData } from '@/lib/data/getAdmin'
import SparkChat from '@/components/spark/SparkChat'

export const dynamic = 'force-dynamic'

export default async function SparkPage() {
  const admin = await getAdminData()
  const name = admin?.displayName?.trim() || admin?.email.split('@')[0] || '管理員'
  return <SparkChat adminName={name} />
}
