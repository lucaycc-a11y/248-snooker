import { NextResponse } from 'next/server'
import { withAdminSecurity } from '@/lib/security/admin-wrapper'
import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// The signed-in admin's own Spark chats, newest first.
export const GET = withAdminSecurity(async (_req, admin) => {
  const { data, error } = await getLegacyServiceSupabase()
    .from('admin_spark_chats')
    .select('id, title, updated_at')
    .eq('admin_user_id', admin.id)
    .order('updated_at', { ascending: false })
    .limit(60)
  if (error) return NextResponse.json({ error: '載入對話失敗' }, { status: 500 })
  return NextResponse.json({ chats: data ?? [] })
})
