import { getAdminDoorCards } from '@/lib/data/getAdminDoorCards'
import DoorCardTable from '@/components/admin/DoorCardTable'
import { adminTokens as tokens } from '@/lib/admin/admin-tokens'

export default async function AdminDoorPage() {
  const initial = await getAdminDoorCards()

  return (
    <div className="admin-stack">
      {initial.error && (
        <div
          role="alert"
          data-cms-key="admin.door.error"
          style={{
            marginBottom: 16,
            padding: '12px 16px',
            borderRadius: 12,
            border: `1px solid ${tokens.colors.danger ?? '#f87171'}`,
            color: tokens.colors.danger ?? '#f87171',
            fontSize: 14,
          }}
        >
          {initial.error}
        </div>
      )}
      <DoorCardTable initial={initial.cards} />
    </div>
  )
}
