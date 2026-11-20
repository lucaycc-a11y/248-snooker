import { NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'
import { writeAdminActionLog } from '@/lib/admin/audit'

// Admin dashboard -> Christmas preview: choose which admin users see the theme.
// super_admin only (same rule as the site-gate switch).
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type AdminRow = { user_id: string | null; email: string; role: string }

export async function GET() {
  const me = await getAdminData()
  if (!me || me.role !== 'super_admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const service = getLegacyServiceSupabase()
  const { data: admins, error } = await service
    .from('admin_users')
    .select('user_id, email, role')
    .eq('is_active', true)
    .not('user_id', 'is', null)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const { data: chosen } = await service.from('christmas_theme_admins').select('user_id')
  const on = new Set((chosen ?? []).map((r: { user_id: string }) => r.user_id))
  const rows = (admins as AdminRow[]).map((a) => ({
    userId: a.user_id as string,
    email: a.email,
    role: a.role,
    enabled: on.has(a.user_id as string),
  }))
  return NextResponse.json({ admins: rows })
}

export async function POST(req: Request) {
  const me = await getAdminData()
  if (!me || me.role !== 'super_admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body: unknown = await req.json().catch(() => null)
  const rec = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {}
  if (typeof rec.userId !== 'string' || typeof rec.enabled !== 'boolean') {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
  const service = getLegacyServiceSupabase()
  // Only an active admin can be chosen.
  const { data: target } = await service
    .from('admin_users')
    .select('user_id')
    .eq('user_id', rec.userId)
    .eq('is_active', true)
    .maybeSingle()
  if (!target) return NextResponse.json({ error: 'Not an active admin' }, { status: 400 })

  const { error } = rec.enabled
    ? await service
        .from('christmas_theme_admins')
        .upsert({ user_id: rec.userId, enabled_by: me.email }, { onConflict: 'user_id' })
    : await service.from('christmas_theme_admins').delete().eq('user_id', rec.userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await writeAdminActionLog({
    adminUserId: me.userId,
    adminEmail: me.email,
    actionType: 'christmas_theme.toggle',
    targetTable: 'christmas_theme_admins',
    targetId: rec.userId,
    beforeJsonb: { enabled: !rec.enabled },
    afterJsonb: { enabled: rec.enabled },
  })
  return NextResponse.json({ ok: true })
}
