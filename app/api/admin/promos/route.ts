/**
 * GET  /api/admin/promos — promotion_codes (the table checkout reads) + real usage
 * POST /api/admin/promos — create a code
 */
import { NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'
import { writeAdminAudit } from '@/lib/admin/audit'
import { parsePromoInput } from '@/lib/admin/promo-input'
import type { Json } from '@/lib/supabase/database.types'

export const runtime = 'nodejs'

export async function GET() {
  const admin = await getAdminData()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = getLegacyServiceSupabase()
  const [codesRes, usageRes] = await Promise.all([
    service.from('promotion_codes').select('*').order('created_at', { ascending: false }),
    service.from('promo_code_usages').select('promo_code_id, status, discount_amount'),
  ])
  if (codesRes.error || usageRes.error) {
    const message = (codesRes.error ?? usageRes.error)?.message ?? 'unknown'
    console.error('[admin/promos] list failed', message)
    return NextResponse.json({ error: `讀取優惠碼失敗：${message}` }, { status: 500 })
  }

  const usage = new Map<string, { held: number; redeemed: number; discount: number }>()
  for (const u of (usageRes.data ?? []) as Array<{ promo_code_id: string; status: string; discount_amount: number | null }>) {
    const cur = usage.get(u.promo_code_id) ?? { held: 0, redeemed: 0, discount: 0 }
    if (u.status === 'held') cur.held += 1
    if (u.status === 'redeemed') {
      cur.redeemed += 1
      cur.discount += Number(u.discount_amount ?? 0)
    }
    usage.set(u.promo_code_id, cur)
  }

  const codes = (codesRes.data ?? []).map((c) => {
    const row = c as unknown as Record<string, unknown> & { id: string }
    const u = usage.get(row.id) ?? { held: 0, redeemed: 0, discount: 0 }
    return { ...row, usage_held: u.held, usage_redeemed: u.redeemed, usage_discount: u.discount }
  })
  return NextResponse.json({ codes })
}

export async function POST(req: Request) {
  try {
    const admin = await getAdminData()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const parsed = parsePromoInput(await req.json().catch(() => null), { requireCode: true })
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

    const service = getLegacyServiceSupabase()
    const { data: adminUser } = await service.from('admin_users').select('id').eq('email', admin.email).maybeSingle()

    const { data, error } = await service
      .from('promotion_codes')
      .insert({ ...parsed.value, created_by: adminUser?.id ?? null })
      .select('*')
      .single()

    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: '此優惠碼已存在' }, { status: 409 })
      console.error('[admin/promos] create failed', error)
      return NextResponse.json({ error: `建立失敗：${error.message}` }, { status: 500 })
    }

    await writeAdminAudit({
      adminUserId: admin.userId,
      adminEmail: admin.email,
      action: 'promo_code_created',
      targetTable: 'promotion_codes',
      targetId: (data as { id: string }).id,
      beforeValue: null,
      afterValue: parsed.value as unknown as Json,
    })
    return NextResponse.json({ code: data }, { status: 201 })
  } catch (err) {
    console.error('[admin/promos] create crash', err)
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 })
  }
}
