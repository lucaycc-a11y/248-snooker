// Go Live endpoint - disables gate (no deploy, just visibility change)
// Admin-only

import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export const runtime = 'edge'

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  )
}

async function checkAdminAuth(supabase: ReturnType<typeof createRouteHandlerClient>) {
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

export async function POST(req: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const auth = await checkAdminAuth(supabase)

    if (!auth.isAdmin || !auth.user) {
      return NextResponse.json({ error: auth.error }, { status: 403 })
    }

    // Get current gate status
    const { data: gateConfigBefore } = await supabase
      .from('site_gate_config')
      .select('enabled')
      .eq('id', '00000000-0000-0000-0000-000000000001')
      .single()

    if (!gateConfigBefore?.enabled) {
      return NextResponse.json({ error: 'Gate already disabled' }, { status: 400 })
    }

    // Disable gate
    await supabase
      .from('site_gate_config')
      .update({ enabled: false, updated_at: new Date().toISOString(), updated_by: auth.user.id })
      .eq('id', '00000000-0000-0000-0000-000000000001')

    // Write audit log
    await supabase.from('audit_log').insert({
      admin_user_id: auth.user.id,
      admin_email: auth.user.email,
      action: 'end_maintenance',
      target_table: 'site_gate_config',
      target_id: '00000000-0000-0000-0000-000000000001',
      before_value: { enabled: true },
      after_value: { enabled: false },
      ip_address: getClientIp(req),
    })

    return NextResponse.json({
      success: true,
      message: 'Maintenance ended, site is now public',
    })
  } catch (error) {
    console.error('[deploy/go-live] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    )
  }
}
