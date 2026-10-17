/**
 * PATCH /api/admin/account-flags/[id]
 *
 * Mark a shared-IP / shared-device flag as reviewed (or reopen it).
 */

import { NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'

export const runtime = 'nodejs'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getAdminData()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body: unknown = await req.json().catch(() => null)
    if (!isRecord(body) || typeof body.reviewed !== 'boolean') {
      return NextResponse.json({ error: 'reviewed must be a boolean' }, { status: 400 })
    }

    const service = getLegacyServiceSupabase()
    const patch = body.reviewed
      ? {
          status: 'reviewed',
          reviewed_by: admin.userId,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
      : {
          status: 'open',
          reviewed_by: null,
          reviewed_at: null,
          updated_at: new Date().toISOString(),
        }

    const { data, error } = await service
      .from('account_flags')
      .update(patch)
      .eq('id', id)
      .select('id, status')
      .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await service.from('audit_log').insert({
      action: body.reviewed ? 'account_flags.review' : 'account_flags.reopen',
      admin_email: admin.email,
      admin_user_id: admin.userId,
      target_table: 'account_flags',
      target_id: id,
      before_value: null,
      after_value: { status: patch.status },
    })

    return NextResponse.json({ ok: true, flag: data })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unexpected error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
