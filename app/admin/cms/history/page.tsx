import { getServiceSupabase } from '@/lib/supabase/service'
import CMSHistoryList, { type HistoryRow } from '@/components/admin/CMSHistoryList'
import { tokens } from '@/app/styles/tokens'

async function getHistory(): Promise<HistoryRow[]> {
  const service = getServiceSupabase()
  const { data } = await service
    .from('cms_versions')
    .select('id, field_key, locale, old_value, new_value, change_source, status, changed_by, created_at')
    .order('created_at', { ascending: false })
    .limit(100)

  const rows = (data ?? []) as {
    id: string
    field_key: string
    locale: string
    old_value: string | null
    new_value: string
    change_source: string
    status: string
    changed_by: string | null
    created_at: string | null
  }[]

  const userIds = Array.from(new Set(rows.map((r) => r.changed_by).filter((v): v is string => !!v)))
  let emailById = new Map<string, string>()
  if (userIds.length > 0) {
    const service2 = getServiceSupabase()
    const { data: admins } = await service2.from('admin_users').select('user_id, email').in('user_id', userIds)
    emailById = new Map(
      ((admins ?? []) as { user_id: string | null; email: string }[])
        .filter((a): a is { user_id: string; email: string } => !!a.user_id)
        .map((a) => [a.user_id, a.email])
    )
  }

  return rows.map((r) => ({
    id: r.id,
    field_key: r.field_key,
    locale: r.locale,
    old_value: r.old_value,
    new_value: r.new_value,
    change_source: r.change_source,
    status: r.status,
    changed_by_email: r.changed_by ? (emailById.get(r.changed_by) ?? null) : null,
    created_at: r.created_at,
  }))
}

export default async function AdminCMSHistoryPage() {
  const rows = await getHistory()

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '32px 16px' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, color: tokens.colors.text, marginBottom: 24 }}>Content history</h1>
      <CMSHistoryList rows={rows} />
    </main>
  )
}
