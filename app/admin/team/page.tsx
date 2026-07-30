import { getServiceSupabase } from '@/lib/supabase/service'
import TeamTable, { type TeamRow } from '@/components/admin/TeamTable'

// Auth (including the super_admin-only invite form gating) is enforced by
// app/admin/layout.tsx + TeamTable's useAdmin() check — this Server Component
// just reads admin_users via the service-role client (never exposed to a
// client-side query, matching the table's RLS: service_role only).

type AdminUserRow = {
  id: string
  email: string
  role: string
  invite_status: string
  invited_by: string | null
  created_at: string | null
}

export default async function AdminTeamPage() {
  const service = getServiceSupabase()

  const { data } = await service
    .from('admin_users')
    .select('id, email, role, invite_status, invited_by, created_at')
    .order('created_at', { ascending: true })

  const rows = (data ?? []) as AdminUserRow[]

  const inviterIds = Array.from(new Set(rows.map((r) => r.invited_by).filter((v): v is string => !!v)))
  let inviterEmailById = new Map<string, string>()
  if (inviterIds.length > 0) {
    const { data: inviters } = await service.from('admin_users').select('user_id, email').in('user_id', inviterIds)
    inviterEmailById = new Map(
      ((inviters ?? []) as { user_id: string | null; email: string }[])
        .filter((r): r is { user_id: string; email: string } => !!r.user_id)
        .map((r) => [r.user_id, r.email])
    )
  }

  const teamRows: TeamRow[] = rows.map((r) => ({
    id: r.id,
    email: r.email,
    role: r.role,
    invite_status: r.invite_status,
    invited_by_email: r.invited_by ? (inviterEmailById.get(r.invited_by) ?? null) : null,
    created_at: r.created_at,
  }))

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '32px 16px' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, color: '#FFFFFF', marginBottom: 24 }}>Team</h1>
      <TeamTable rows={teamRows} />
    </main>
  )
}
