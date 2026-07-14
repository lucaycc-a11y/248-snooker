import { NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { getServiceSupabase } from '@/lib/supabase/service'

// Super_admin-only revoke / role-change for an existing admin_users row.
// Blocks self-modification for both actions (spec: can't revoke yourself;
// extended to role changes too — a super_admin demoting themselves has the
// same lockout risk if they're the only super_admin).

type TargetRow = { id: string; user_id: string | null; role: string; invite_status: string; email: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getAdminData()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (admin.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const body: unknown = await req.json().catch(() => null)
    if (!isRecord(body)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const action = body.action === 'revoke' ? 'revoke' : body.action === 'set_role' ? 'set_role' : null
    if (!action) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    let newRole: 'admin' | 'super_admin' | null = null
    if (action === 'set_role') {
      newRole = body.role === 'super_admin' ? 'super_admin' : body.role === 'admin' ? 'admin' : null
      if (!newRole) return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }

    const service = getServiceSupabase()

    const { data: existing } = await service
      .from('admin_users')
      .select('id, user_id, role, invite_status, email')
      .eq('id', id)
      .maybeSingle()
    const target = existing as TargetRow | null
    if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (target.user_id === admin.userId) {
      return NextResponse.json({ error: 'cannot_modify_self' }, { status: 400 })
    }

    const patch = action === 'revoke' ? { invite_status: 'revoked' } : { role: newRole }

    const { error } = await service.from('admin_users').update(patch).eq('id', id)
    if (error) {
      console.error('[admin/team] update failed', error)
      return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }

    await service.from('audit_log').insert({
      admin_user_id: admin.userId,
      admin_email: admin.email,
      action: action === 'revoke' ? 'admin_revoke' : 'admin_role_change',
      target_table: 'admin_users',
      target_id: target.email,
      before_value: { role: target.role, invite_status: target.invite_status },
      after_value: { ...target, ...patch },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[admin/team] unexpected error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
