import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function checkAdminAuth() {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) return { authorized: false, userId: null }

  const { data: adminData } = await supabase
    .from('admin_users')
    .select('is_active')
    .eq('user_id', session.user.id)
    .single()

  return {
    authorized: adminData?.is_active || false,
    userId: session.user.id,
  }
}

export async function GET() {
  try {
    const { authorized } = await checkAdminAuth()
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createClient()

    // Get whitelist
    const { data: whitelist } = await supabase
      .from('site_gate_ip_whitelist')
      .select('*')
      .order('added_at', { ascending: false })

    // Get pending requests (denied IPs not in whitelist)
    const { data: accessLog } = await supabase
      .from('site_gate_access_log')
      .select('*')
      .eq('method', 'denied')
      .order('attempted_at', { ascending: false })
      .limit(100)

    // Group by IP and get first/last seen
    const pendingMap = new Map()
    for (const log of accessLog || []) {
      // Skip if already whitelisted
      if (whitelist?.some((w) => w.ip_address === log.ip_address)) continue

      if (!pendingMap.has(log.ip_address)) {
        pendingMap.set(log.ip_address, {
          ip: log.ip_address,
          firstSeen: log.attempted_at,
          lastSeen: log.attempted_at,
          count: 1,
          userAgent: log.user_agent,
        })
      } else {
        const entry = pendingMap.get(log.ip_address)
        entry.count++
        entry.lastSeen = log.attempted_at
      }
    }

    const pending = Array.from(pendingMap.values())

    return NextResponse.json({
      whitelist: whitelist || [],
      pending,
    })
  } catch (error) {
    console.error('Error fetching IP data:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { authorized, userId } = await checkAdminAuth()
    if (!authorized || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { ip, label } = await request.json()

    if (!ip) {
      return NextResponse.json({ error: 'IP required' }, { status: 400 })
    }

    const supabase = await createClient()

    // Add to whitelist
    await supabase.from('site_gate_ip_whitelist').insert({
      ip_address: ip,
      label: label || null,
      added_at: new Date().toISOString(),
    })

    // Audit log
    await supabase.from('audit_log').insert({
      user_id: userId,
      action: 'ip_whitelist_add',
      details: { ip, label },
      created_at: new Date().toISOString(),
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error adding IP:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { authorized, userId } = await checkAdminAuth()
    if (!authorized || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { ip } = await request.json()

    if (!ip) {
      return NextResponse.json({ error: 'IP required' }, { status: 400 })
    }

    const supabase = await createClient()

    await supabase.from('site_gate_ip_whitelist').delete().eq('ip_address', ip)

    await supabase.from('audit_log').insert({
      user_id: userId,
      action: 'ip_whitelist_remove',
      details: { ip },
      created_at: new Date().toISOString(),
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error removing IP:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
