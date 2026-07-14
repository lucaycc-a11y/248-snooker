import { NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { getServiceSupabase } from '@/lib/supabase/service'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export async function POST(req: Request) {
  try {
    const admin = await getAdminData()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body: unknown = await req.json().catch(() => null)
    const label = isRecord(body) && typeof body.label === 'string' ? body.label.trim() : ''
    if (!label) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

    const service = getServiceSupabase()
    const { data, error } = await service
      .from('door_card_registration_requests')
      .insert({ label, requested_by: admin.userId })
      .select('id')
      .single()

    if (error || !data) {
      console.error('[admin/door/register-request] insert failed', error)
      return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }

    return NextResponse.json({ id: data.id })
  } catch (err) {
    console.error('[admin/door/register-request] unexpected error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
