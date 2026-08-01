import { getAdminDoorCards } from '@/lib/data/getAdminDoorCards'
import DoorCardTable from '@/components/admin/DoorCardTable'
import { tokens } from '@/app/styles/tokens'

export default async function AdminDoorPage() {
  const initial = await getAdminDoorCards()

  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: '32px 16px' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, color: tokens.colors.text, marginBottom: 24 }}>Door Lock</h1>
      <DoorCardTable initial={initial.cards} />
    </main>
  )
}
