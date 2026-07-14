import { NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { getServiceSupabase } from '@/lib/supabase/service'

type RequestRow = {
  id: string
  label: string
  status: string
  uid: string | null
  expires_at: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getAdminData()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body: unknown = await req.json().catch(() => null)
    const label = isRecord(body) && typeof body.label === 'string' ? body.label.trim() : ''
    if (!label) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

    const service = getServiceSupabase()

    const { data: existing } = await service
      .from('door_card_registration_requests')
      .select('id, label, status, uid, expires_at')
      .eq('id', id)
      .maybeSingle()
    const request = existing as RequestRow | null
    if (!request) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (new Date(request.expires_at).getTime() < Date.now()) {
      await service.from('door_card_registration_requests').update({ status: 'expired' }).eq('id', id)
      return NextResponse.json({ error: 'Request expired' }, { status: 409 })
    }

    if (request.status !== 'scanned' || !request.uid) {
      return NextResponse.json({ error: 'Card not scanned yet' }, { status: 409 })
    }

    const { data: card, error: insertError } = await service
      .from('staff_nfc_cards')
      .insert({ uid: request.uid, label, created_by: admin.userId })
      .select('id, uid, label, active')
      .single()

    if (insertError || !card) {
      console.error('[admin/door/register-request] confirm insert failed', insertError)
      return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }

    await service
      .from('door_card_registration_requests')
      .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
      .eq('id', id)

    await service.from('audit_log').insert({
      admin_user_id: admin.userId,
      admin_email: admin.email,
      action: 'door_card_register',
      target_table: 'staff_nfc_cards',
      target_id: card.id,
      before_value: null,
      after_value: { uid: card.uid, label: card.label },
    })

    return NextResponse.json({ card })
  } catch (err) {
    console.error('[admin/door/register-request] unexpected error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
