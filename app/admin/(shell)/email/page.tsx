import { redirect } from 'next/navigation'
import { getAdminData } from '@/lib/data/getAdmin'
import EmailComposer from '@/components/admin/email/EmailComposer'

export const metadata = { title: '電郵發送 — Space8 後台' }
export const dynamic = 'force-dynamic'

export default async function AdminEmailPage() {
  const admin = await getAdminData()
  if (!admin) redirect('/admin/login')
  return <EmailComposer adminEmail={admin.email} />
}
