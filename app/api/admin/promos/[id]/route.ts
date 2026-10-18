/**
 * PATCH /api/admin/promos/[id] — edit a code, or enable/disable it.
 * There is no DELETE: usage history references the code, so a code is disabled, never removed.
 */
import { NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'
import { writeAdminAudit } from '@/lib/admin/audit'
import { parsePromoInput, STATUSES } from '@/lib/admin/promo-input'
import type { Json } from '@/lib/supabase/database.types'

export const runtime = 'nodejs'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getAdminData()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body: unknown = await req.json().catch(() => null)
    const service = getLegacyServiceSupabase()

    const { data: before, error: readErr } = await service.from('promotion_codes').select('*').eq('id', id).maybeSingle()
    if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 })
    if (!before) return NextResponse.json({ error: '找不到優惠碼' }, { status: 404 })

    let updates: Record<string, unknown>
    const rec = (body ?? {}) as Record<string, unknown>
    if (Object.keys(rec).length === 1 && typeof rec.status === 'string') {
      // status-only toggle
      if (!STATUSES.includes(rec.status as never)) return NextResponse.json({ error: '狀態無效' }, { status: 400 })
      updates = { status: rec.status, is_active: rec.status === 'active' }
    } else {
      const parsed = parsePromoInput({ ...(before as Record<string, unknown>), ...rec }, { requireCode: false })
      if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
      updates = { ...parsed.value }
    }

    const { data, error } = await service.from('promotion_codes').update(updates).eq('id', id).select('*').single()
    if (error) {
      console.error('[admin/promos] update failed', error)
      return NextResponse.json({ error: `更新失敗：${error.message}` }, { status: 500 })
    }

    await writeAdminAudit({
      adminUserId: admin.userId,
      adminEmail: admin.email,
      action: 'promo_code_updated',
      targetTable: 'promotion_codes',
      targetId: id,
      beforeValue: before as unknown as Json,
      afterValue: updates as unknown as Json,
    })
    return NextResponse.json({ code: data })
  } catch (err) {
    console.error('[admin/promos] update crash', err)
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 })
  }
}
