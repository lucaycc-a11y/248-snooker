import { NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { getServiceSupabase } from '@/lib/supabase/service'

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminData()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  try {
    const body = await req.json()
    if (!isRecord(body)) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

    const updates: Record<string, unknown> = {}

    if ('is_active' in body) updates.is_active = !!body.is_active
    if ('points_required' in body) {
      const v = Number(body.points_required)
      if (!Number.isInteger(v) || v <= 0) {
        return NextResponse.json({ error: 'points_required must be a positive integer' }, { status: 400 })
      }
      updates.points_required = v
    }
    if ('discount_amount' in body) {
      const v = Number(body.discount_amount)
      if (isNaN(v) || v < 0) {
        return NextResponse.json({ error: 'discount_amount must be non-negative' }, { status: 400 })
      }
      updates.discount_amount = v
    }
    if ('display_order' in body) updates.display_order = Number(body.display_order)

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const service = getServiceSupabase()
    const { data, error } = await service
      .from('points_redemption_rules')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[admin/points-rules/id] update failed', error)
      return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }

    console.log('[admin/points-rules/id] updated', { adminId: admin.userId, id, updates })
    return NextResponse.json({ rule: data })
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
