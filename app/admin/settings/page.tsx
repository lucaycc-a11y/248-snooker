import { getConfig, getConfigValue } from '@/lib/data/getConfig'
import SettingsForm from '@/components/admin/SettingsForm'

// Auth already enforced by app/admin/layout.tsx (Phase 0). This page just
// reads current config values server-side and hands them to the client form.

export default async function AdminSettingsPage() {
  const config = await getConfig()
  const bookingRules = await getConfigValue('booking_rules', { refundCutoffHours: 1 })

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '32px 16px' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, color: '#FFFFFF', marginBottom: 24 }}>Settings</h1>
      <SettingsForm
        site={{
          currency: config.currency,
          maxHours: config.maxHours,
          openHour: config.openHour,
          closeHour: config.closeHour,
        }}
        pricing={{ periods: config.periods, services: config.services }}
        tiers={config.tiers}
        bookingRules={bookingRules}
      />
    </main>
  )
}
