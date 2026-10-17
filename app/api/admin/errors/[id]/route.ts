/**
 * Admin site error log API.
 *
 * PATCH: mark a `site_error_log` row resolved/unresolved.
 * Every change is written to `audit_log`.
 *
 * Design system: admin-theme.css variables only.
 */

import { NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'

export const dynamic = 'force-dynamic'

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const admin = await getAdminData()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await ctx.params
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const body: unknown = await req.json()
    if (!isRecord(body) || typeof body.resolved !== 'boolean') {
      return NextResponse.json({ error: 'resolved must be a boolean' }, { status: 400 })
    }
    const resolved = body.resolved

    const supabase = getLegacyServiceSupabase()

    const { data: before, error: readError } = await supabase
      .from('site_error_log')
      .select('id, resolved')
      .eq('id', id)
      .single()

    if (readError || !before) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const { data: after, error: updateError } = await supabase
      .from('site_error_log')
      .update({ resolved })
      .eq('id', id)
      .select('id, resolved')
      .single()

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    await supabase.from('audit_log').insert({
      action: 'error.resolve',
      admin_email: admin.email,
      admin_user_id: admin.userId,
      target_table: 'site_error_log',
      target_id: id,
      before_value: { resolved: before.resolved ?? false },
      after_value: { resolved },
    })

    return NextResponse.json({ ok: true, error: after })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unexpected error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
