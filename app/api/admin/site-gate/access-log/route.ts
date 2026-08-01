import { NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { getServiceSupabase } from '@/lib/supabase/service'

export const runtime = 'nodejs'

const VALID_METHODS = new Set(['whitelist', 'password', 'denied'])
const LOG_QUERY_LIMIT = 200

// GET /api/admin/site-gate/access-log?method=denied&from=<iso> — filtered log
// for SiteGateLog's client-side filter controls. Server component render
// (getAdminSiteGate) still supplies the unfiltered first paint.
export async function GET(req: Request) {
  const admin = await getAdminData()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const method = url.searchParams.get('method')
  const from = url.searchParams.get('from')

  if (method && !VALID_METHODS.has(method)) {
    return NextResponse.json({ error: 'Invalid method filter' }, { status: 400 })
  }

  const service = getServiceSupabase()
  let query = service
    .from('site_gate_access_log')
    .select('id, ip_address, method, user_agent, attempted_at')
    .order('attempted_at', { ascending: false })
    .limit(LOG_QUERY_LIMIT)

  if (method) query = query.eq('method', method)
  if (from) query = query.gte('attempted_at', from)

  const { data, error } = await query
  if (error) {
    console.error('[admin/site-gate/access-log] query failed', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }

  const log = ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    ipAddress: (r.ip_address as string | null) ?? null,
    method: String(r.method),
    userAgent: (r.user_agent as string | null) ?? null,
    attemptedAt: (r.attempted_at as string | null) ?? null,
  }))

  return NextResponse.json({ log })
}
