import { NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'
import { str, type Row } from '@/lib/data/adminReadHelpers'
import { writeAdminActionLog } from '@/lib/admin/audit'
import { getPublicPaymentSystem, isPaymentSystem, type PaymentSystem } from '@/lib/payments/system'

// 後台 → 設定 → 支付系統.
//  • Public system (what every customer without an override uses): super_admin only, with a
//    two-step confirmation: the request must say confirmed=true AND carry the target system's
//    name typed out by hand (checked here, not just in the browser).
//  • Per-account override (which account uses which system): any signed-in admin.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SYSTEM_NAME: Record<PaymentSystem, string> = { kpay: 'KPay', stripe: 'Stripe', paymentx: 'PaymentX' }

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

export async function GET() {
  try {
    const admin = await getAdminData()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const db = getLegacyServiceSupabase()

    const publicSystem = await getPublicPaymentSystem()
    const { data: cfg } = await db.from('payment_system_config').select('updated_by, updated_at').eq('id', 1).maybeSingle()

    const { data: rows } = await db
      .from('payment_system_overrides')
      .select('user_id, system, note, added_by, created_at')
      .order('created_at', { ascending: false })
    const list = (rows ?? []) as Row[]
    const ids = list.map((r) => String(r.user_id))
    let users = new Map<string, Row>()
    if (ids.length > 0) {
      const { data } = await db.from('users').select('id, email, display_name, member_code').in('id', ids)
      users = new Map(((data ?? []) as Row[]).map((u) => [String(u.id), u]))
    }
    return NextResponse.json({
      publicSystem,
      updatedBy: cfg ? str(cfg as Row, ['updated_by']) : null,
      updatedAt: cfg ? str(cfg as Row, ['updated_at']) : null,
      canChangePublic: admin.role === 'super_admin',
      overrides: list.map((r) => {
        const u = users.get(String(r.user_id))
        return {
          userId: String(r.user_id),
          system: String(r.system),
          email: u ? str(u, ['email']) : null,
          displayName: u ? str(u, ['display_name']) : null,
          memberCode: u ? str(u, ['member_code']) : null,
          note: str(r, ['note']),
          addedBy: str(r, ['added_by']),
          createdAt: str(r, ['created_at']),
        }
      }),
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: `支付系統資料載入失敗：${message}` }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const admin = await getAdminData()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body: unknown = await req.json().catch(() => null)
    if (!isRecord(body) || typeof body.action !== 'string') {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
    }
    const db = getLegacyServiceSupabase()

    if (body.action === 'search') {
      const q = typeof body.q === 'string' ? body.q.replace(/[,()%*\\]/g, ' ').trim() : ''
      if (q.length < 2) return NextResponse.json({ users: [] })
      const { data } = await db
        .from('users')
        .select('id, email, display_name, member_code')
        .or(`email.ilike.%${q}%,display_name.ilike.%${q}%,member_code.ilike.%${q}%`)
        .limit(8)
      return NextResponse.json({
        users: ((data ?? []) as Row[]).map((u) => ({
          userId: String(u.id),
          email: str(u, ['email']),
          displayName: str(u, ['display_name']),
          memberCode: str(u, ['member_code']),
        })),
      })
    }

    if (body.action === 'set_public') {
      if (admin.role !== 'super_admin') {
        return NextResponse.json({ error: '只有 super admin 可以切換公開支付系統' }, { status: 403 })
      }
      const system = body.system
      if (!isPaymentSystem(system)) return NextResponse.json({ error: 'Invalid system' }, { status: 400 })
      if (body.confirmed !== true) return NextResponse.json({ error: '需要再次確認' }, { status: 400 })
      const typed = typeof body.confirmText === 'string' ? body.confirmText.trim() : ''
      if (typed.toLowerCase() !== SYSTEM_NAME[system].toLowerCase()) {
        return NextResponse.json({ error: `請輸入「${SYSTEM_NAME[system]}」確認` }, { status: 400 })
      }
      const before = await getPublicPaymentSystem()
      if (before === system) return NextResponse.json({ ok: true, publicSystem: system, unchanged: true })
      const { error } = await db
        .from('payment_system_config')
        .upsert({ id: 1, public_system: system, updated_by: admin.email, updated_at: new Date().toISOString() }, { onConflict: 'id' })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      await writeAdminActionLog({
        adminUserId: admin.userId,
        adminEmail: admin.email,
        actionType: 'payment_system.set_public',
        targetTable: 'payment_system_config',
        targetId: '1',
        beforeJsonb: { publicSystem: before },
        afterJsonb: { publicSystem: system },
      })
      return NextResponse.json({ ok: true, publicSystem: system })
    }

    if (body.action === 'set_override' || body.action === 'remove_override') {
      const userId = typeof body.userId === 'string' ? body.userId : ''
      if (!UUID_RE.test(userId)) return NextResponse.json({ error: 'Invalid userId' }, { status: 400 })
      if (body.action === 'set_override') {
        const system = body.system
        if (!isPaymentSystem(system)) return NextResponse.json({ error: 'Invalid system' }, { status: 400 })
        const note = typeof body.note === 'string' ? body.note.trim().slice(0, 200) : null
        const { error } = await db
          .from('payment_system_overrides')
          .upsert({ user_id: userId, system, note: note || null, added_by: admin.email }, { onConflict: 'user_id' })
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      } else {
        const { error } = await db.from('payment_system_overrides').delete().eq('user_id', userId)
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      }
      await writeAdminActionLog({
        adminUserId: admin.userId,
        adminEmail: admin.email,
        actionType: `payment_system.${body.action}`,
        targetTable: 'payment_system_overrides',
        targetId: userId,
        afterJsonb: { userId, system: body.action === 'set_override' ? body.system : null },
      })
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[admin/payment-system] POST failed', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
