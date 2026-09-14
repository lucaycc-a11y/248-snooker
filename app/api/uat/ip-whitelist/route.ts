import { NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { getServiceSupabase } from '@/lib/supabase/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/uat/ip-whitelist — admin-only: fetch IP whitelist and access log
export async function GET() {
  const admin = await getAdminData()
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const service = getServiceSupabase()

  // Fetch IP whitelist
  const { data: whitelist, error: whitelistError } = await service
    .from('site_gate_ip_whitelist')
    .select('ip_address, added_at')
    .order('added_at', { ascending: false })

  if (whitelistError) {
    console.error('[uat/ip-whitelist GET] whitelist fetch failed', whitelistError)
    return NextResponse.json({ error: 'Failed to fetch whitelist' }, { status: 500 })
  }

  // Fetch recent access log (last 100 entries)
  const { data: accessLog, error: logError } = await service
    .from('site_gate_access_log')
    .select('ip_address, method, pathname, attempted_at, user_agent')
    .order('attempted_at', { ascending: false })
    .limit(100)

  if (logError) {
    console.error('[uat/ip-whitelist GET] access log fetch failed', logError)
    return NextResponse.json({ error: 'Failed to fetch access log' }, { status: 500 })
  }

  return NextResponse.json({
    whitelist: whitelist ?? [],
    accessLog: accessLog ?? [],
  })
}

// POST /api/uat/ip-whitelist — admin-only: add IP to whitelist
// Body: { ip: string }
export async function POST(req: Request) {
  const admin = await getAdminData()
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const ip = typeof body?.ip === 'string' ? body.ip.trim() : ''

  // Basic IP validation (IPv4 or IPv6)
  const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/
  const ipv6Pattern = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/

  if (!ipv4Pattern.test(ip) && !ipv6Pattern.test(ip)) {
    return NextResponse.json({ error: 'Invalid IP address format' }, { status: 400 })
  }

  const service = getServiceSupabase()
  const { error } = await service
    .from('site_gate_ip_whitelist')
    .upsert({ ip_address: ip }, { onConflict: 'ip_address' })

  if (error) {
    console.error('[uat/ip-whitelist POST] insert failed', error)
    return NextResponse.json({ error: 'Failed to add IP' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

// DELETE /api/uat/ip-whitelist — admin-only: remove IP from whitelist
// Body: { ip: string }
export async function DELETE(req: Request) {
  const admin = await getAdminData()
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const ip = typeof body?.ip === 'string' ? body.ip.trim() : ''

  if (!ip) {
    return NextResponse.json({ error: 'IP address required' }, { status: 400 })
  }

  const service = getServiceSupabase()
  const { error } = await service
    .from('site_gate_ip_whitelist')
    .delete()
    .eq('ip_address', ip)

  if (error) {
    console.error('[uat/ip-whitelist DELETE] delete failed', error)
    return NextResponse.json({ error: 'Failed to remove IP' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
