/**
 * Gate status API - returns current gate state and whether the viewer has bypassed it
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/service'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  const service = getServiceSupabase()

  // Get gate config
  const { data: gateConfig } = await service
    .from('site_gate_config')
    .select('enabled, reason')
    .eq('id', '00000000-0000-0000-0000-000000000001')
    .single()

  const enabled = gateConfig?.enabled ?? false
  const reason = gateConfig?.reason ?? 'prelaunch'

  // Check if user has bypassed (has the gate cookie)
  const cookieStore = await cookies()
  const gateCookie = cookieStore.get('space8_gate_bypass')
  const bypassed = !!gateCookie

  return NextResponse.json({
    enabled,
    reason,
    bypassed,
  })
}
