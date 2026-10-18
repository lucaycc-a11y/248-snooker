import { getAdminDoorCards } from '@/lib/data/getAdminDoorCards'
import DoorCardTable from '@/components/admin/DoorCardTable'
import { tokens } from '@/app/styles/tokens'

export default async function AdminDoorPage() {
  const initial = await getAdminDoorCards()

  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: '32px 16px' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, color: tokens.colors.text, marginBottom: 24 }}>門鎖</h1>
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
    </main>
  )
}
