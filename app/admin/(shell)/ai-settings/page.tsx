import { getServiceSupabase } from '@/lib/supabase/service'
import AiSettingsForm from '@/components/admin/AiSettingsForm'
import { adminTokens as tokens } from '@/lib/admin/admin-tokens'

async function getInitialSettings() {
  // TODO: ai_widget_settings table doesn't exist yet (see docs/prompt5-db-requests.md)
  // Return empty array until table is created
  return []
}

export default async function AdminAiSettingsPage() {
  const settings = await getInitialSettings()

  return (
    <div className="admin-stack">
      <AiSettingsForm initialSettings={settings} />
    </div>
  )
}
