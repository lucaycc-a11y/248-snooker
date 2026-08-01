import { getAdminMembers } from '@/lib/data/getAdminMembers'
import MemberTable from '@/components/admin/MemberTable'
import { tokens } from '@/app/styles/tokens'

export default async function AdminMembersPage() {
  const initial = await getAdminMembers({ page: 1 })

  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: '32px 16px' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, color: tokens.colors.text, marginBottom: 24 }}>Members</h1>
      <MemberTable initial={initial} />
    </main>
  )
}
