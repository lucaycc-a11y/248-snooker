// Dev2 Panel: IP Whitelist Management
// List, approve pending requests, and delete whitelist entries

import { NextRequest, NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { getServiceSupabase } from '@/lib/supabase/service'

export const runtime = 'edge'

// GET - List whitelist and pending requests
export async function GET() {
  const admin = await getAdminData()
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const service = getServiceSupabase()

    // Get current whitelist
    const { data: whitelist, error: whitelistError } = await service
      .from('site_gate_ip_whitelist')
      .select('*')
      .order('created_at', { ascending: false })

    if (whitelistError) throw whitelistError

    // Get denied access attempts (pending requests)
    const { data: deniedAttempts, error: deniedError } = await service
      .from('site_gate_access_log')
      .select('ip_address, user_agent, attempted_at, pathname')
      .eq('method', 'denied')
      .order('attempted_at', { ascending: false })
      .limit(500)

    if (deniedError) throw deniedError

    // Group by IP and exclude already whitelisted IPs
    const whitelistedIps = new Set((whitelist || []).map((w) => w.ip_address))
    const pendingMap = new Map<
      string,
      { ip: string; firstSeen: string; lastSeen: string; count: number; userAgents: string[] }
    >()

    for (const attempt of deniedAttempts || []) {
      if (whitelistedIps.has(attempt.ip_address)) continue

      const existing = pendingMap.get(attempt.ip_address)
      if (existing) {
        existing.count++
        existing.lastSeen = attempt.attempted_at
        if (attempt.user_agent && !existing.userAgents.includes(attempt.user_agent)) {
          existing.userAgents.push(attempt.user_agent)
        }
      } else {
        pendingMap.set(attempt.ip_address, {
          ip: attempt.ip_address,
          firstSeen: attempt.attempted_at,
          lastSeen: attempt.attempted_at,
          count: 1,
          userAgents: attempt.user_agent ? [attempt.user_agent] : [],
        })
      }
    }

    return NextResponse.json({
      whitelist: (whitelist || []).map((w) => ({
        id: w.id,
        ipAddress: w.ip_address,
        label: w.label,
        createdAt: w.created_at,
      })),
      pending: Array.from(pendingMap.values()),
    })
  } catch (error) {
    console.error('[dev2/ip-whitelist] GET error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// POST - Approve pending IP request
export async function POST(req: NextRequest) {
  const admin = await getAdminData()
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { ip, label } = body

    if (!ip || typeof ip !== 'string') {
      return NextResponse.json({ error: 'ip required' }, { status: 400 })
    }

    const service = getServiceSupabase()

    // Check if already whitelisted
    const { data: existing } = await service
      .from('site_gate_ip_whitelist')
      .select('id')
      .eq('ip_address', ip)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: 'IP already whitelisted' }, { status: 409 })
    }

    // Insert into whitelist
    const { data: newEntry, error: insertError } = await service
      .from('site_gate_ip_whitelist')
      .insert({
        ip_address: ip,
        label: label || `Approved by ${admin.email}`,
      })
      .select()
      .single()

    if (insertError) throw insertError

    // Write audit log
    await service.from('audit_log').insert({
      admin_user_id: admin.userId,
      admin_email: admin.email,
      action: 'approve_ip_whitelist',
      target_table: 'site_gate_ip_whitelist',
      target_id: newEntry.id,
      before_value: null,
      after_value: { ip_address: ip, label: newEntry.label },
    })

    return NextResponse.json({
      success: true,
      entry: {
        id: newEntry.id,
        ipAddress: newEntry.ip_address,
        label: newEntry.label,
        createdAt: newEntry.created_at,
      },
    })
  } catch (error) {
    console.error('[dev2/ip-whitelist] POST error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// DELETE - Remove IP from whitelist
export async function DELETE(req: NextRequest) {
  const admin = await getAdminData()
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'id parameter required' }, { status: 400 })
    }

    const service = getServiceSupabase()

    // Get existing entry for audit log
    const { data: existing } = await service
      .from('site_gate_ip_whitelist')
      .select('*')
      .eq('id', id)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'IP not found' }, { status: 404 })
    }

    // Delete entry
    const { error: deleteError } = await service
      .from('site_gate_ip_whitelist')
      .delete()
      .eq('id', id)

    if (deleteError) throw deleteError

    // Write audit log
    await service.from('audit_log').insert({
      admin_user_id: admin.userId,
      admin_email: admin.email,
      action: 'delete_ip_whitelist',
      target_table: 'site_gate_ip_whitelist',
      target_id: id,
      before_value: { ip_address: existing.ip_address, label: existing.label },
      after_value: null,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[dev2/ip-whitelist] DELETE error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
