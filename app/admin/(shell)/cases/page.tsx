import CasesManager from '@/components/admin/CasesManager'

export const dynamic = 'force-dynamic'

export default function AdminCasesPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <header>
        <p className="text-sm" style={{ color: 'var(--admin-text-tertiary)' }} data-cms-key="admin.cases.subtitle">
          會員違反場地守則時在此開案：系統會發 email 及收件箱通知，並附 KPay 付款連結，繳費後自動結案
        </p>
      </header>
      <CasesManager />
    </div>
  )
}
