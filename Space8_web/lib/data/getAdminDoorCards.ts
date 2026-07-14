import { getServiceSupabase } from '@/lib/supabase/service'
import { str, type Row } from '@/lib/data/adminReadHelpers'

export type DoorCardRow = {
  id: string
  uid: string
  label: string
  active: boolean
  createdAt: string | null
  createdBy: string | null
}

export type AdminDoorCardsResult = { cards: DoorCardRow[] }

export async function getAdminDoorCards(): Promise<AdminDoorCardsResult> {
  const service = getServiceSupabase()

  try {
    const { data, error } = await service
      .from('staff_nfc_cards')
      .select('id, uid, label, active, created_at, created_by')
      .order('created_at', { ascending: false })
    if (error) throw error

    const rows = (data ?? []) as Row[]
    const cards: DoorCardRow[] = rows.map((r) => ({
      id: String(r.id),
      uid: str(r, ['uid']) ?? '',
      label: str(r, ['label']) ?? '',
      active: Boolean(r.active),
      createdAt: str(r, ['created_at']),
      createdBy: str(r, ['created_by']),
    }))

    return { cards }
  } catch (err) {
    console.error('[admin/door] query failed', err)
    return { cards: [] }
  }
}
