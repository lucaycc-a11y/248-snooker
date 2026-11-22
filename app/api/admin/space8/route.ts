import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { withAdminSecurity } from '@/lib/security/admin-wrapper'
import { getAdminData } from '@/lib/data/getAdmin'
import { getServiceSupabase } from '@/lib/supabase/service'
import { isDateStr } from '@/lib/admin/space8Ledger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// SPACE8 費用帳 writes. super_admin only (money). Tables are service-role only (RLS, no policies).
// POST   { type: 'expense', kind, spentOn, item, amount, paidBy, note? }
//        { type: 'claim', claimedOn, amount, paidTo, note? }
// DELETE { type: 'expense' | 'claim', id }

const db = () => getServiceSupabase() as unknown as SupabaseClient
const MAX_AMOUNT = 10_000_000
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const obj = (v: unknown): Record<string, unknown> => (typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {})
const text = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null
  const s = v.trim()
  return s.length >= 1 && s.length <= max ? s : null
}
const optText = (v: unknown, max: number): string | null => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)
const money = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN
  return Number.isFinite(n) && n > 0 && n <= MAX_AMOUNT ? Math.round(n * 100) / 100 : null
}

async function requireSuperAdmin(): Promise<NextResponse | null> {
  const admin = await getAdminData()
  return admin?.role === 'super_admin' ? null : NextResponse.json({ error: '只限 super admin' }, { status: 403 })
}

const bad = (msg = '資料不正確，請檢查') => NextResponse.json({ error: msg }, { status: 400 })

export const POST = withAdminSecurity(
  async (req) => {
    const denied = await requireSuperAdmin()
    if (denied) return denied
    const b = obj(await req.json().catch(() => null))
    try {
      if (b.type === 'expense') {
        const kind = b.kind === 'ai' || b.kind === 'other' ? b.kind : null
        const amount = money(b.amount)
        const item = kind === 'ai' ? 'AI Usage' : text(b.item, 80)
        const paidBy = text(b.paidBy, 40)
        if (!kind || !amount || !item || !paidBy || !isDateStr(b.spentOn)) return bad()
        const { error } = await db().from('space8_expenses').insert({ kind, spent_on: b.spentOn, item, amount, paid_by: paidBy, note: optText(b.note, 200) })
        if (error) throw error
        return NextResponse.json({ ok: true })
      }
      if (b.type === 'claim') {
        const amount = money(b.amount)
        const paidTo = text(b.paidTo, 40)
        if (!amount || !paidTo || !isDateStr(b.claimedOn)) return bad()
        const { error } = await db().from('space8_claims').insert({ claimed_on: b.claimedOn, amount, paid_to: paidTo, note: optText(b.note, 200) })
        if (error) throw error
        return NextResponse.json({ ok: true })
      }
      return bad()
    } catch (err) {
      console.error('[admin/space8] create failed', err)
      return NextResponse.json({ error: '儲存失敗，請再試' }, { status: 500 })
    }
  },
  { rateLimit: { bucket: 'admin_space8_write', max: 60, windowSeconds: 60, identifierType: 'user' } },
)

export const DELETE = withAdminSecurity(
  async (req) => {
    const denied = await requireSuperAdmin()
    if (denied) return denied
    const b = obj(await req.json().catch(() => null))
    const table = b.type === 'expense' ? 'space8_expenses' : b.type === 'claim' ? 'space8_claims' : null
    if (!table || typeof b.id !== 'string' || !UUID.test(b.id)) return bad()
    try {
      const { error } = await db().from(table).delete().eq('id', b.id)
      if (error) throw error
      return NextResponse.json({ ok: true })
    } catch (err) {
      console.error('[admin/space8] delete failed', err)
      return NextResponse.json({ error: '刪除失敗，請再試' }, { status: 500 })
    }
  },
  { rateLimit: { bucket: 'admin_space8_write', max: 60, windowSeconds: 60, identifierType: 'user' } },
)
