import { NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { getServiceSupabase } from '@/lib/supabase/service'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export async function GET() {
  const admin = await getAdminData()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = getServiceSupabase()
  const { data, error } = await service
    .from('promotion_codes')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[admin/promos] list failed', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
  return NextResponse.json({ codes: data ?? [] })
}

export async function POST(req: Request) {
  try {
    const admin = await getAdminData()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body: unknown = await req.json().catch(() => null)
    if (
      !isRecord(body) ||
      typeof body.code !== 'string' ||
      !body.code.trim() ||
      typeof body.discount_type !== 'string' ||
      !['percentage', 'fixed_amount'].includes(body.discount_type) ||
      typeof body.discount_value !== 'number' ||
      body.discount_value <= 0
    ) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const service = getServiceSupabase()

    // Resolve admin id from admin_users
    const { data: adminUser } = await service
      .from('admin_users')
      .select('id')
      .eq('email', admin.email)
      .single()

    const insertBody: Record<string, unknown> = {
      code: body.code.trim().toUpperCase(),
      discount_type: body.discount_type,
      discount_value: body.discount_value,
      max_uses: typeof body.max_uses === 'number' ? body.max_uses : null,
      valid_from: body.valid_from ?? new Date().toISOString(),
      valid_until: body.valid_until ?? null,
      min_cart_amount: typeof body.min_cart_amount === 'number' ? body.min_cart_amount : null,
      is_active: body.is_active !== false,
      created_by: adminUser?.id ?? null,
    }

    const { data, error } = await service
      .from('promotion_codes')
      .insert(insertBody)
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Code already exists' }, { status: 409 })
      }
      console.error('[admin/promos] create failed', error)
      return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }

    await service.from('audit_log').insert({
      admin_user_id: admin.userId,
      admin_email: admin.email,
      action: 'promo_code_created',
      target_table: 'promotion_codes',
      after_value: { code: body.code.trim().toUpperCase(), discount_type: body.discount_type, discount_value: body.discount_value },
    })

    return NextResponse.json({ code: data })
  } catch (err) {
    console.error('[admin/promos] create crash', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}