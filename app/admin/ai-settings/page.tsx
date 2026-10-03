import { getServiceSupabase } from '@/lib/supabase/service'
import AiSettingsForm from '@/components/admin/AiSettingsForm'
import { tokens } from '@/app/styles/tokens'

async function getInitialSettings() {
  // TODO: ai_widget_settings table doesn't exist yet (see docs/prompt5-db-requests.md)
  // Return empty array until table is created
  return []
}

export default async function AdminAiSettingsPage() {
  const settings = await getInitialSettings()

  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: '32px 16px' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, color: tokens.colors.text, marginBottom: 24 }}>AI Settings</h1>
      <AiSettingsForm initialSettings={settings} />
    </main>
  )
}
