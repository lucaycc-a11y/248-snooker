import { NextResponse } from 'next/server'
import { requireAppAdmin, NO_STORE } from '@/lib/admin/app-guard'
import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'

// POST /api/admin/app/feed/read — mark the whole feed read for this admin.
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const g = await requireAppAdmin(req)
  if (!g.ok) return g.res
  await getLegacyServiceSupabase()
    .from('app_admin_feed_state')
    .upsert({ user_id: g.admin.userId, last_read_at: new Date().toISOString() }, { onConflict: 'user_id' })
  return NextResponse.json({ ok: true }, { headers: NO_STORE })
}
