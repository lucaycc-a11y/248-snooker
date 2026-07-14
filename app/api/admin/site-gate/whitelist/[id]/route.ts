import { NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { getServiceSupabase } from '@/lib/supabase/service'

export const runtime = 'nodejs'

// DELETE /api/admin/site-gate/whitelist/[id] — remove an entry.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminData()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const service = getServiceSupabase()

  const { data: existing } = await service
    .from('site_gate_ip_whitelist')
    .select('ip_address, label')
    .eq('id', id)
    .maybeSingle()

  const { error } = await service.from('site_gate_ip_whitelist').delete().eq('id', id)
  if (error) {
    console.error('[admin/site-gate/whitelist] delete failed', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }

  await service.from('audit_log').insert({
    admin_user_id: admin.userId,
    admin_email: admin.email,
    action: 'site_gate_whitelist_remove',
    target_table: 'site_gate_ip_whitelist',
    target_id: id,
    before_value: existing ?? null,
    after_value: null,
  })

  return NextResponse.json({ success: true })
}
