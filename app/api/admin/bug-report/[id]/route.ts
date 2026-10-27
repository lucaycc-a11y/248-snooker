import { NextResponse } from 'next/server'
import { withAdminSecurity } from '@/lib/security/admin-wrapper'
import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const STATUSES = ['open', 'in_progress', 'resolved'] as const
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const PATCH = withAdminSecurity(async (req, _admin, context) => {
  const id = context?.params.id ?? ''
  if (!UUID_RE.test(id)) return NextResponse.json({ error: '編號不正確' }, { status: 400 })
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '資料格式不正確' }, { status: 400 })
  }
  const raw = typeof body === 'object' && body !== null ? (body as Record<string, unknown>).status : undefined
  const status = STATUSES.find((s) => s === raw)
  if (!status) return NextResponse.json({ error: '狀態不正確' }, { status: 400 })

  const service = getLegacyServiceSupabase()
  const { error } = await service
    .from('admin_bug_reports')
    .update({ status, resolved_at: status === 'resolved' ? new Date().toISOString() : null })
    .eq('id', id)
  if (error) return NextResponse.json({ error: '更新失敗' }, { status: 500 })
  return NextResponse.json({ ok: true })
})
