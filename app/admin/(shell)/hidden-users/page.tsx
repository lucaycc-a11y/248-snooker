import { getAdminData } from '@/lib/data/getAdmin'
import HiddenUsersManager from '@/components/admin/HiddenUsersManager'

export const dynamic = 'force-dynamic'

export default async function AdminHiddenUsersPage() {
  const admin = await getAdminData()
  const canManage = admin?.role === 'super_admin'

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1
            className="text-xl font-semibold"
            style={{ color: 'var(--admin-text-primary)' }}
            data-cms-key="admin.hidden_users.title"
          >
            隱藏帳戶
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--admin-text-tertiary)' }} data-cms-key="admin.hidden_users.subtitle">
            管理員及內部帳戶不會出現在會員列表、預約列表或任何收入合計中
          </p>
        </div>
      </header>

      <HiddenUsersManager canManage={canManage} />
    </div>
  )
}
