import { getCMSGrouped } from '@/lib/data/getAdminCMS'
import CMSEditor from '@/components/admin/CMSEditor'
import { tokens } from '@/app/styles/tokens'

export default async function AdminCMSPage() {
  const groups = await getCMSGrouped('zh-HK')

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '32px 16px' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, color: tokens.colors.text, marginBottom: 24 }}>Content</h1>
      <CMSEditor groups={groups} />
    </main>
  )
}
