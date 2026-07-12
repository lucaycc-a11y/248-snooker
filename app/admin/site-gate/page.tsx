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
      <h1 style={{ fontSize: 28, fontWeight: 700, color: '#FFFFFF', marginBottom: 24 }}>Site Gate</h1>
      <SiteGateForm
        initialEnabled={data.enabled}
        initialHasPassword={data.hasPassword}
        initialWhitelist={data.whitelist}
      />
      <SiteGateLog initial={data.log} />
    </main>
  )
}
