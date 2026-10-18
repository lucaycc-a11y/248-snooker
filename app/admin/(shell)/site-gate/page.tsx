import { getAdminSiteGate } from '@/lib/data/getAdminSiteGate'
import SiteGateForm from '@/components/admin/SiteGateForm'
import SiteGateLog from '@/components/admin/SiteGateLog'

// Auth already enforced by app/admin/layout.tsx (Phase 0), same as
// app/admin/settings/page.tsx. Reads current gate state server-side and
// hands it to the client form/log components.

export default async function AdminSiteGatePage() {
  const data = await getAdminSiteGate()

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '32px 16px' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, color: '#FFFFFF', marginBottom: 24 }}>網站閘門</h1>
      {data.error && (
        <div
          role="alert"
          data-cms-key="admin.site_gate.error"
          style={{
            marginBottom: 16,
            padding: '12px 16px',
            borderRadius: 12,
            border: '1px solid var(--admin-danger, #f87171)',
            color: 'var(--admin-danger, #f87171)',
            fontSize: 14,
          }}
        >
          {data.error}
        </div>
      )}
      <SiteGateForm
        initialEnabled={data.enabled}
        initialHasPassword={data.hasPassword}
        initialWhitelist={data.whitelist}
      />
      <SiteGateLog initial={data.log} initialWhitelistedIps={data.whitelist.map((w) => w.ipAddress)} />
    </main>
  )
}
