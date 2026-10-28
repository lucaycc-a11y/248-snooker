import { NextResponse } from 'next/server'
import { withAdminSecurity } from '@/lib/security/admin-wrapper'
import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = withAdminSecurity(async () => {
  const { data, error } = await getLegacyServiceSupabase()
    .from('admin_email_sends')
    .select('id, subject, audience_kind, recipient_count, sent_count, failed_count, admin_email, created_at')
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) return NextResponse.json({ error: '載入記錄失敗' }, { status: 500 })
  return NextResponse.json({ sends: data ?? [] })
}, { csrf: false })
