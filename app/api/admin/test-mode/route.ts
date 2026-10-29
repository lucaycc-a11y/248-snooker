/**
 * GET  /api/admin/test-mode            -> { me, admins[] } (admins only for super_admin)
 * POST /api/admin/test-mode {userId, enabled}  -> super_admin only
 */
import { NextResponse } from 'next/server'
import { withAdminSecurity } from '@/lib/security/admin-wrapper'
import { getAdminData } from '@/lib/data/getAdmin'
import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'
import { writeAdminActionLog } from '@/lib/admin/audit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Row = Record<string, unknown>
const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null)

export const GET = withAdminSecurity(async () => {
  const me = await getAdminData()
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data, error } = await getLegacyServiceSupabase()
    .from('admin_users')
    .select('user_id, email, role, is_active, test_mode, test_mode_set_by, test_mode_set_at')
    .eq('is_active', true)
    .not('user_id', 'is', null)
    .order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: '載入失敗' }, { status: 500 })
  const admins = ((data ?? []) as Row[]).map((r) => ({
    userId: String(r.user_id),
    email: String(r.email ?? ''),
    role: String(r.role ?? ''),
    testMode: r.test_mode === true,
    setBy: str(r.test_mode_set_by),
    setAt: str(r.test_mode_set_at),
  }))
  const mine = admins.find((a) => a.userId === me.userId)
  return NextResponse.json({
    isSuperAdmin: me.role === 'super_admin',
    meTestMode: mine?.testMode ?? false,
    admins: me.role === 'super_admin' ? admins : [],
  })
}, { csrf: false })

export const POST = withAdminSecurity(async (req: Request) => {
  const me = await getAdminData()
  if (!me || me.role !== 'super_admin') return NextResponse.json({ error: '只有超級管理員可以更改' }, { status: 403 })
  const body = (await req.json().catch(() => null)) as { userId?: unknown; enabled?: unknown } | null
  if (typeof body?.userId !== 'string' || typeof body.enabled !== 'boolean') {
    return NextResponse.json({ error: '資料無效' }, { status: 400 })
  }
  const { data, error } = await getLegacyServiceSupabase()
    .from('admin_users')
    .update({ test_mode: body.enabled, test_mode_set_by: me.email, test_mode_set_at: new Date().toISOString() })
    .eq('user_id', body.userId)
    .eq('is_active', true)
    .select('user_id')
  if (error || !data || data.length === 0) return NextResponse.json({ error: '找不到該管理員' }, { status: 404 })
  try {
    await writeAdminActionLog({
      adminUserId: me.userId,
      adminEmail: me.email,
      actionType: body.enabled ? 'admin_test_mode_on' : 'admin_test_mode_off',
      targetTable: 'admin_users',
      afterJsonb: { targetUserId: body.userId, enabled: body.enabled },
    })
  } catch {
    /* audit is best-effort */
  }
  return NextResponse.json({ ok: true })
})
