import { NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { getServiceSupabase } from '@/lib/supabase/service'

type CardRow = { id: string; uid: string; label: string; active: boolean }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getAdminData()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body: unknown = await req.json().catch(() => null)
    if (!isRecord(body) || typeof body.active !== 'boolean') {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const service = getServiceSupabase()

    const { data: existing } = await service
      .from('staff_nfc_cards')
      .select('id, uid, label, active')
      .eq('id', id)
      .maybeSingle()
    const target = existing as CardRow | null
    if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { error } = await service.from('staff_nfc_cards').update({ active: body.active }).eq('id', id)
    if (error) {
      console.error('[admin/door/cards] update failed', error)
      return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }

    await service.from('audit_log').insert({
      admin_user_id: admin.userId,
      admin_email: admin.email,
      action: body.active ? 'door_card_enable' : 'door_card_disable',
      target_table: 'staff_nfc_cards',
      target_id: target.id,
      before_value: { active: target.active },
      after_value: { active: body.active },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[admin/door/cards] unexpected error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getAdminData()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const service = getServiceSupabase()

    const { data: existing } = await service
      .from('staff_nfc_cards')
      .select('id, uid, label, active')
      .eq('id', id)
      .maybeSingle()
    const target = existing as CardRow | null
    if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { error } = await service.from('staff_nfc_cards').delete().eq('id', id)
    if (error) {
      console.error('[admin/door/cards] delete failed', error)
      return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }

    await service.from('audit_log').insert({
      admin_user_id: admin.userId,
      admin_email: admin.email,
      action: 'door_card_delete',
      target_table: 'staff_nfc_cards',
      target_id: target.id,
      before_value: { uid: target.uid, label: target.label, active: target.active },
      after_value: null,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[admin/door/cards] unexpected error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
