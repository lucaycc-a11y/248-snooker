// Gate status endpoint for maintenance badge
// Returns whether gate is enabled and if current request has bypass access

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

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const clientIp = getClientIp(req)

    // Get gate config
    const { data: gateConfig } = await supabase
      .from('site_gate_config')
      .select('enabled')
      .eq('id', '00000000-0000-0000-0000-000000000001')
      .single()

    if (!gateConfig) {
      return NextResponse.json({ enabled: false, isWhitelisted: false, hasBypass: false })
    }

    // Check if IP is whitelisted
    const { data: whitelistEntry } = await supabase
      .from('site_gate_ip_whitelist')
      .select('id')
      .eq('ip_address', clientIp)
      .single()

    // Check for bypass cookie (simplified check - actual verification happens in middleware)
    const bypassCookie = req.cookies.get('site_gate_bypass')

    return NextResponse.json({
      enabled: gateConfig.enabled,
      isWhitelisted: !!whitelistEntry,
      hasBypass: !!bypassCookie,
    })
  } catch (error) {
    console.error('[maintenance/gate-status] Error:', error)
    return NextResponse.json({ enabled: false, isWhitelisted: false, hasBypass: false })
  }
}
