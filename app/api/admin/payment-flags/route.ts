import { NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'
import { writeAdminActionLog } from '@/lib/admin/audit'
import { getReturnTokenMode, type ReturnTokenMode } from '@/lib/payments/return-token'

// 後台 → 系統 → 支付系統 → 免登入付款返回頁 switch (v4.2.0 test). Any signed-in admin.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const admin = await getAdminData()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const secretConfigured = typeof process.env.RETURN_TOKEN_SECRET === 'string' && process.env.RETURN_TOKEN_SECRET.length >= 16
  return NextResponse.json({ returnToken: await getReturnTokenMode(), secretConfigured })
}

export async function POST(req: Request) {
  try {
    const admin = await getAdminData()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body: unknown = await req.json().catch(() => null)
    const mode = typeof body === 'object' && body !== null ? (body as Record<string, unknown>).returnToken : undefined
    if (mode !== 'off' && mode !== 'admins') return NextResponse.json({ error: 'Invalid mode' }, { status: 400 })
    const before: ReturnTokenMode = await getReturnTokenMode()
    const { error } = await getLegacyServiceSupabase()
      .from('payment_feature_flags')
      .upsert({ key: 'return_token', mode, updated_by: admin.email, updated_at: new Date().toISOString() }, { onConflict: 'key' })
    if (error) return NextResponse.json({ error: `儲存失敗：${error.message}` }, { status: 500 })
    await writeAdminActionLog({
      adminUserId: admin.userId,
      adminEmail: admin.email,
      actionType: 'payment_flag.return_token',
      targetTable: 'payment_feature_flags',
      targetId: 'return_token',
      beforeJsonb: { mode: before },
      afterJsonb: { mode },
    })
    return NextResponse.json({ ok: true, returnToken: mode })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
