import { NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { getAdminDoorCards } from '@/lib/data/getAdminDoorCards'

export async function GET() {
  try {
    const admin = await getAdminData()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { cards } = await getAdminDoorCards()
    return NextResponse.json({ cards })
  } catch (err) {
    console.error('[admin/door/cards] unexpected error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
