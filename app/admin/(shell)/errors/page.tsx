import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'
import ErrorLogList, { type SiteErrorRow } from '@/components/admin/ErrorLogList'

export const dynamic = 'force-dynamic'

export default async function AdminErrorsPage() {
  const supabase = getLegacyServiceSupabase()

  const { data } = await supabase
    .from('site_error_log')
    .select('id, source, severity, message, resolved, created_at')
    .order('created_at', { ascending: false })
    .limit(200)

  const rows: SiteErrorRow[] = (data ?? []).map((row) => ({
    id: row.id,
    source: row.source,
    severity: row.severity,
    message: row.message,
    resolved: row.resolved,
    created_at: row.created_at,
  }))

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1
            className="text-xl font-semibold"
            style={{ color: 'var(--admin-text-primary)' }}
            data-cms-key="admin.errors.title"
          >
            錯誤記錄
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--admin-text-tertiary)' }} data-cms-key="admin.errors.subtitle">
            系統寫入的錯誤與警告，可標記為已解決
          </p>
        </div>
      </header>

      <ErrorLogList rows={rows} />
    </div>
  )
}
