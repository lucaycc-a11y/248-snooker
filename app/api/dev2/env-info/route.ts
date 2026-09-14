// Dev2 Panel: Environment Info
// Returns current environment state, admin user info, IP whitelist status

import { NextRequest, NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { getServiceSupabase } from '@/lib/supabase/service'

export const runtime = 'edge'

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  )
}

export async function GET(req: NextRequest) {
  const admin = await getAdminData()
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const service = getServiceSupabase()
    const clientIp = getClientIp(req)

    // Get gate config
    const { data: gateConfig } = await service
      .from('site_gate_config')
      .select('enabled')
      .eq('id', '00000000-0000-0000-0000-000000000001')
      .single()

    // Check if current IP is whitelisted
    const { data: whitelistEntry } = await service
      .from('site_gate_ip_whitelist')
      .select('ip_address')
      .eq('ip_address', clientIp)
      .maybeSingle()

    // Get active UAT test pricing
    const { data: activePrice } = await service
      .from('uat_test_pricing')
      .select('*')
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    return NextResponse.json({
      env: process.env.NEXT_PUBLIC_APP_ENV || 'production',
      admin: {
        userId: admin.userId,
        email: admin.email,
        role: admin.role,
        displayName: admin.displayName,
      },
      clientIp,
      isIpWhitelisted: !!whitelistEntry,
      gateEnabled: gateConfig?.enabled ?? false,
      activeTestPrice: activePrice
        ? {
            mode: activePrice.mode,
            amount: activePrice.amount,
            label: activePrice.label,
          }
        : null,
    })
  } catch (error) {
    console.error('[dev2/env-info] error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
