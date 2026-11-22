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
// PATCH  same body as POST plus { id } — edits an existing row
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

type Row = Record<string, string | number | null>

function parseExpense(b: Record<string, unknown>): Row | null {
  const kind = b.kind === 'ai' || b.kind === 'other' ? b.kind : null
  const amount = money(b.amount)
  const item = kind === 'ai' ? 'AI Usage' : text(b.item, 80)
  const paidBy = text(b.paidBy, 40)
  if (!kind || !amount || !item || !paidBy || !isDateStr(b.spentOn)) return null
  return { kind, spent_on: b.spentOn, item, amount, paid_by: paidBy, note: optText(b.note, 200) }
}

function parseClaim(b: Record<string, unknown>): Row | null {
  const amount = money(b.amount)
  const paidTo = text(b.paidTo, 40)
  if (!amount || !paidTo || !isDateStr(b.claimedOn)) return null
  return { claimed_on: b.claimedOn, amount, paid_to: paidTo, note: optText(b.note, 200) }
}

const TABLES = { expense: 'space8_expenses', claim: 'space8_claims' } as const

async function write(req: Request, mode: 'insert' | 'update'): Promise<Response> {
  const denied = await requireSuperAdmin()
  if (denied) return denied
  const b = obj(await req.json().catch(() => null))
  const type = b.type === 'expense' || b.type === 'claim' ? b.type : null
  if (!type) return bad()
  const row = type === 'expense' ? parseExpense(b) : parseClaim(b)
  if (!row) return bad()
  try {
    const table = db().from(TABLES[type])
    if (mode === 'insert') {
      const { error } = await table.insert(row)
      if (error) throw error
    } else {
      if (typeof b.id !== 'string' || !UUID.test(b.id)) return bad()
      const { error } = await table.update(row).eq('id', b.id)
      if (error) throw error
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error(`[admin/space8] ${mode} failed`, err)
    return NextResponse.json({ error: '儲存失敗，請再試' }, { status: 500 })
  }
}

const limit = { rateLimit: { bucket: 'admin_space8_write', max: 60, windowSeconds: 60, identifierType: 'user' as const } }
export const POST = withAdminSecurity((req) => write(req, 'insert'), limit)
export const PATCH = withAdminSecurity((req) => write(req, 'update'), limit)

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
