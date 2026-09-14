import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check admin auth
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: adminData } = await supabase
      .from('admin_users')
      .select('is_active, role')
      .eq('user_id', session.user.id)
      .single()

    if (!adminData?.is_active) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get client IP
    const forwarded = request.headers.get('x-forwarded-for')
    const clientIp = forwarded ? forwarded.split(',')[0].trim() : request.headers.get('x-real-ip') || 'unknown'

    // Check if IP is whitelisted
    const { data: whitelist } = await supabase
      .from('site_gate_ip_whitelist')
      .select('ip_address')
      .eq('ip_address', clientIp)
      .single()

    // Get gate config
    const { data: gateConfig } = await supabase
      .from('site_gate_config')
      .select('enabled, reason')
      .single()

    // Get active test pricing
    const { data: activePrice } = await supabase
      .from('uat_test_pricing')
      .select('mode, amount, label')
      .eq('is_active', true)
      .single()

    return NextResponse.json({
      env: process.env.NEXT_PUBLIC_APP_ENV || 'unknown',
      admin: {
        userId: session.user.id,
        email: session.user.email || '',
        role: adminData.role,
        displayName: session.user.user_metadata?.display_name || null,
      },
      clientIp,
      isIpWhitelisted: !!whitelist,
      gateEnabled: gateConfig?.enabled || false,
      gateReason: gateConfig?.reason || null,
      activeTestPrice: activePrice || null,
    })
  } catch (error) {
    console.error('Error fetching env info:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
