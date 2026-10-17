/**
 * Admin maintenance_log API — delete a booking block.
 *
 * DELETE: remove a block and write an audit_log row.
 */

import { NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    const admin = await getAdminData()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await ctx.params
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const supabase = getLegacyServiceSupabase()

    const { data: before, error: readError } = await supabase
      .from('maintenance_log')
      .select('id, date, start_time, end_time, table_number, reason')
      .eq('id', id)
      .single()

    if (readError || !before) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const { error: deleteError } = await supabase.from('maintenance_log').delete().eq('id', id)
    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })

    await supabase.from('audit_log').insert({
      action: 'maintenance.remove',
      admin_email: admin.email,
      admin_user_id: admin.userId,
      target_table: 'maintenance_log',
      target_id: id,
      before_value: before,
      after_value: null,
    })

    return NextResponse.json({ ok: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unexpected error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
