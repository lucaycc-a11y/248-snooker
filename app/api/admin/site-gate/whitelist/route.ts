import { NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { getServiceSupabase } from '@/lib/supabase/service'

export const runtime = 'nodejs'

// Loose IPv4/IPv6 sanity check — good enough to reject typos without
// pulling in a dedicated IP-parsing dependency.
const IP_PATTERN = /^[0-9a-fA-F.:]+$/

function isValidIp(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 45 && IP_PATTERN.test(value)
}

// GET /api/admin/site-gate/whitelist — list entries.
export async function GET() {
  const admin = await getAdminData()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = getServiceSupabase()
  const { data, error } = await service
    .from('site_gate_ip_whitelist')
    .select('id, ip_address, label, created_at')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[admin/site-gate/whitelist] list failed', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
  return NextResponse.json({ entries: data ?? [] })
}

// POST /api/admin/site-gate/whitelist  { ip, label? } — add an entry.
export async function POST(req: Request) {
  try {
    const admin = await getAdminData()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body: unknown = await req.json().catch(() => null)
    const ip = (body as { ip?: unknown } | null)?.ip
    const label = (body as { label?: unknown } | null)?.label
    if (!isValidIp(ip)) {
      return NextResponse.json({ error: 'Invalid IP address' }, { status: 400 })
    }
    if (label !== undefined && typeof label !== 'string') {
      return NextResponse.json({ error: 'Invalid label' }, { status: 400 })
    }

    const service = getServiceSupabase()
    const { data, error } = await service
      .from('site_gate_ip_whitelist')
      .insert({ ip_address: ip, label: label ?? null })
      .select('id, ip_address, label, created_at')
      .single()

    if (error) {
      const status = error.code === '23505' ? 409 : 500
      if (status === 500) console.error('[admin/site-gate/whitelist] insert failed', error)
      return NextResponse.json({ error: status === 409 ? 'IP already whitelisted' : 'Internal error' }, { status })
    }

    await service.from('audit_log').insert({
      admin_user_id: admin.userId,
      admin_email: admin.email,
      action: 'site_gate_whitelist_add',
      target_table: 'site_gate_ip_whitelist',
      target_id: data.id,
      before_value: null,
      after_value: { ip_address: ip, label: label ?? null },
    })

    return NextResponse.json({ entry: data })
  } catch (err) {
    console.error('[admin/site-gate/whitelist] unexpected error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
