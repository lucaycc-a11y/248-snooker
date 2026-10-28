import { NextResponse } from 'next/server'
import { withAdminSecurity } from '@/lib/security/admin-wrapper'
import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'

export const runtime = 'nodejs'

export const DELETE = withAdminSecurity(async (_req, _admin, context) => {
  const id = context?.params?.id ?? ''
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  const { error } = await getLegacyServiceSupabase().from('admin_email_templates').delete().eq('id', id)
  if (error) return NextResponse.json({ error: '刪除失敗' }, { status: 500 })
  return NextResponse.json({ ok: true })
})
