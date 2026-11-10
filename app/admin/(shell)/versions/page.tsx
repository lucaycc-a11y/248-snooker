import AdminPageHead from '@/components/admin/AdminPageHead'
import { getAppVersions, type AppVersionRow } from '@/lib/data/getAppVersion'

// Auth is enforced by app/admin/(shell)/layout.tsx.
export const dynamic = 'force-dynamic'

function List({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 600, opacity: 0.7, marginBottom: 4 }}>{title}</div>
      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, lineHeight: 1.7 }}>
        {items.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
    </div>
  )
}

function fmt(iso: string): string {
  return new Date(iso).toLocaleString('zh-HK', { timeZone: 'Asia/Hong_Kong', hour12: false })
}

function VersionCard({ v }: { v: AppVersionRow }) {
  return (
    <section
      style={{
        border: '1px solid var(--admin-border, rgba(128,128,128,0.25))',
        borderRadius: 16,
        padding: '18px 20px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{v.label}</h2>
        <span style={{ fontSize: 13, opacity: 0.65 }}>
          {v.isTest ? `測試中，預計 ${fmt(v.releasedAt)} 正式發佈` : `${fmt(v.releasedAt)} 正式發佈`}
        </span>
      </div>
      <List title="新增" items={v.adds} />
      <List title="更改" items={v.changes} />
      <List title="移除" items={v.removes} />
    </section>
  )
}

export default async function AdminVersionsPage() {
  const versions = await getAppVersions()
  return (
    <div className="admin-stack">
      <AdminPageHead sub="每個版本新增、更改及移除的內容。測試版本只有 admin 見到，到發佈時間自動轉為正式版。" />
      {versions.length === 0 ? (
        <p style={{ fontSize: 14, opacity: 0.7 }}>暫時沒有版本記錄。</p>
      ) : (
        versions.map((v) => <VersionCard key={v.version} v={v} />)
      )}
    </div>
  )
}
