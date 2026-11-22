import { redirect } from 'next/navigation'
import { getAdminData } from '@/lib/data/getAdmin'
import { getSpace8Ledger } from '@/lib/data/getSpace8Ledger'
import Space8Ledger from '@/components/admin/Space8Ledger'
import { hkNow } from '@/lib/admin/today'

// SPACE8 費用帳 — 開支、各人先墊付款、Claim 扣減，可匯出 PDF。super_admin only (money).
// Auth shell: app/admin/(shell)/layout.tsx. Data: space8_* tables (service role).
export const dynamic = 'force-dynamic'

export default async function AdminSpace8Page() {
  const admin = await getAdminData()
  if (admin?.role !== 'super_admin') redirect('/admin')
  const data = await getSpace8Ledger()
  return <Space8Ledger data={data} today={hkNow().date} />
}
