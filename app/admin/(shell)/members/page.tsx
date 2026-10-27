/**
 * Admin Members page — prototype `vMembers()` shell.
 *
 * Server component: fetches member rows, hands them to MembersPageClient which
 * owns the 會員 head, 會員列表|帳戶異常 tabs, search, filters and 卡片|表格 toggle.
 * The 帳戶異常 tab keeps the real <AccountFlagsList />; everything else matches
 * space8-admin.html one-for-one.
 */

import { getAdminMembers } from '@/lib/data/getAdminMembers'
import { getAdminData } from '@/lib/data/getAdmin'
import MembersPageClient from '@/components/admin/MembersPageClient'
import AccountFlagsList from '@/components/admin/AccountFlagsList'

export default async function AdminMembersPage() {
  const [result, admin] = await Promise.all([getAdminMembers({ page: 1 }), getAdminData()])

  return (
    <MembersPageClient
      members={result.members}
      total={result.total}
      error={result.error}
      flagsSlot={<AccountFlagsList />}
      isSuperAdmin={admin?.role === 'super_admin'}
    />
  )
}
