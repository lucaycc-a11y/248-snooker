import { NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { getServiceSupabase } from '@/lib/supabase/service'

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

export async function GET() {
  const admin = await getAdminData()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = getServiceSupabase()
  const { data, error } = await service
    .from('points_redemption_rules')
    .select('*')
    .order('display_order')

  if (error) {
    console.error('[admin/points-rules] list failed', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
  return NextResponse.json({ rules: data ?? [] })
}

export async function POST(req: Request) {
  const admin = await getAdminData()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    if (!isRecord(body)) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

    const pointsRequired = Number(body.points_required)
    const discountAmount = Number(body.discount_amount)
    const displayOrder = Number(body.display_order ?? 0)

    if (!Number.isInteger(pointsRequired) || pointsRequired <= 0) {
      return NextResponse.json({ error: 'points_required must be a positive integer' }, { status: 400 })
    }
    if (isNaN(discountAmount) || discountAmount < 0) {
      return NextResponse.json({ error: 'discount_amount must be non-negative' }, { status: 400 })
    }

    const service = getServiceSupabase()
    const { data, error } = await service
      .from('points_redemption_rules')
      .insert({ points_required: pointsRequired, discount_amount: discountAmount, display_order: displayOrder })
      .select()
      .single()

    if (error) {
      console.error('[admin/points-rules] insert failed', error)
      return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }

    console.log('[admin/points-rules] created', { adminId: admin.userId, rule: data })
    return NextResponse.json({ rule: data }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
