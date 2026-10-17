/**
 * Admin account risk flags API.
 *
 * GET: list open/reviewed shared-IP and shared-device flags.
 * POST: recompute flags from auth_risk_events (read-time grouping).
 */

import { NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'
import { refreshAccountFlags } from '@/lib/auth/risk-events'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const admin = await getAdminData()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const status = new URL(req.url).searchParams.get('status') ?? 'open'
    const service = getLegacyServiceSupabase()

    let query = service
      .from('account_flags')
      .select('id, flag_type, flag_key, member_ids, event_count, first_seen, last_seen, status, reviewed_at')
      .order('last_seen', { ascending: false })
      .limit(200)

    if (status !== 'all') {
      query = query.eq('status', status)
    }

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ flags: data ?? [] })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unexpected error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST() {
  try {
    const admin = await getAdminData()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const result = await refreshAccountFlags()
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    await getLegacyServiceSupabase().from('audit_log').insert({
      action: 'account_flags.refresh',
      admin_email: admin.email,
      admin_user_id: admin.userId,
      target_table: 'account_flags',
      target_id: null,
      before_value: null,
      after_value: { flagged: result.flagged },
    })

    return NextResponse.json({ ok: true, flagged: result.flagged })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unexpected error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
