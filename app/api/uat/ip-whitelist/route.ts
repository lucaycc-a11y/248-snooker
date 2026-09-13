// UAT IP whitelist management - admin-only endpoint
// ONLY accessible when NEXT_PUBLIC_APP_ENV === 'uat'
// Writes to production site_gate_ip_whitelist table - requires active admin user

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'edge'

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  )
}

async function checkAdminAuth(supabase: ReturnType<typeof createClient>) {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { isAdmin: false, user: null, error: 'Not authenticated' }
  }

  const { data: adminEntry } = await supabase
    .from('admin_users')
    .select('user_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  return {
    isAdmin: !!adminEntry,
    user,
    adminRole: adminEntry?.role || null,
    error: adminEntry ? null : 'Not authorized - admin access required',
  }
}

// GET - List all whitelisted IPs (admin-only)
export async function GET(req: NextRequest) {
  if (process.env.NEXT_PUBLIC_APP_ENV !== 'uat') {
    return NextResponse.json({ error: 'Not available' }, { status: 404 })
  }

  try {
    const supabase = createRouteHandlerClient({ cookies })
    const auth = await checkAdminAuth(supabase)

    if (!auth.isAdmin) {
      return NextResponse.json({ error: auth.error }, { status: 403 })
    }

    const { data: entries, error } = await supabase
      .from('site_gate_ip_whitelist')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ entries: entries || [] })
  } catch (error) {
    console.error('[uat/ip-whitelist] GET error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// POST - Add IP to whitelist (admin-only)
export async function POST(req: NextRequest) {
  if (process.env.NEXT_PUBLIC_APP_ENV !== 'uat') {
    return NextResponse.json({ error: 'Not available' }, { status: 404 })
  }

  try {
    const supabase = createRouteHandlerClient({ cookies })
    const auth = await checkAdminAuth(supabase)

    if (!auth.isAdmin || !auth.user) {
      return NextResponse.json({ error: auth.error }, { status: 403 })
    }

    const body = await req.json()
    const { addCurrent, ip_address, label } = body

    let targetIp: string
    let targetLabel: string | null

    if (addCurrent) {
      // Add the request's client IP
      targetIp = getClientIp(req)
      targetLabel = `${auth.user.email} @ ${new Date().toISOString()}`
    } else {
      // Add manually specified IP
      if (!ip_address || typeof ip_address !== 'string') {
        return NextResponse.json({ error: 'ip_address required' }, { status: 400 })
      }
      targetIp = ip_address.trim()
      targetLabel = label || null
    }

    // Check if IP already exists
    const { data: existing } = await supabase
      .from('site_gate_ip_whitelist')
      .select('id')
      .eq('ip_address', targetIp)
      .single()

    if (existing) {
      return NextResponse.json({ error: 'IP already whitelisted' }, { status: 409 })
    }

    // Insert new whitelist entry
    const { data: newEntry, error: insertError } = await supabase
      .from('site_gate_ip_whitelist')
      .insert({
        ip_address: targetIp,
        label: targetLabel,
      })
      .select()
      .single()

    if (insertError) throw insertError

    // Write audit log
    await supabase.from('audit_log').insert({
      target_table: 'site_gate_ip_whitelist',
      action: 'insert',
      admin_user_id: auth.user.id,
      before_value: null,
      after_value: { ip_address: targetIp, label: targetLabel },
    })

    return NextResponse.json(newEntry)
  } catch (error) {
    console.error('[uat/ip-whitelist] POST error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// DELETE - Remove IP from whitelist (admin-only)
export async function DELETE(req: NextRequest) {
  if (process.env.NEXT_PUBLIC_APP_ENV !== 'uat') {
    return NextResponse.json({ error: 'Not available' }, { status: 404 })
  }

  try {
    const supabase = createRouteHandlerClient({ cookies })
    const auth = await checkAdminAuth(supabase)

    if (!auth.isAdmin || !auth.user) {
      return NextResponse.json({ error: auth.error }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'id parameter required' }, { status: 400 })
    }

    // Get existing entry for audit log
    const { data: existing } = await supabase
      .from('site_gate_ip_whitelist')
      .select('*')
      .eq('id', id)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'IP not found' }, { status: 404 })
    }

    // Delete entry
    const { error: deleteError } = await supabase.from('site_gate_ip_whitelist').delete().eq('id', id)

    if (deleteError) throw deleteError

    // Write audit log
    await supabase.from('audit_log').insert({
      target_table: 'site_gate_ip_whitelist',
      action: 'delete',
      admin_user_id: auth.user.id,
      before_value: { ip_address: existing.ip_address, label: existing.label },
      after_value: null,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[uat/ip-whitelist] DELETE error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
