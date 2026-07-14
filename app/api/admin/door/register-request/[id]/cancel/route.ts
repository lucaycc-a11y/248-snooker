import { NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { getServiceSupabase } from '@/lib/supabase/service'

type RequestRow = { id: string; status: string }

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getAdminData()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const service = getServiceSupabase()

    const { data: existing } = await service
      .from('door_card_registration_requests')
      .select('id, status')
      .eq('id', id)
      .maybeSingle()
    const request = existing as RequestRow | null
    if (!request) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (request.status === 'confirmed' || request.status === 'cancelled') {
      return NextResponse.json({ success: true })
    }

    const { error } = await service
      .from('door_card_registration_requests')
      .update({ status: 'cancelled' })
      .eq('id', id)

    if (error) {
      console.error('[admin/door/register-request] cancel failed', error)
      return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[admin/door/register-request] unexpected error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
