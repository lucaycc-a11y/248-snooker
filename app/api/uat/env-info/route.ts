// UAT env info endpoint - returns current environment details
// ONLY accessible when NEXT_PUBLIC_APP_ENV === 'uat'

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

export async function GET(req: NextRequest) {
  // Gate: only respond in UAT environment
  if (process.env.NEXT_PUBLIC_APP_ENV !== 'uat') {
    return NextResponse.json({ error: 'Not available' }, { status: 404 })
  }

  try {
    const supabase = createRouteHandlerClient({ cookies })
    const clientIp = getClientIp(req)

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    // Check if IP is whitelisted
    const { data: whitelistEntry } = await supabase
      .from('site_gate_ip_whitelist')
      .select('id')
      .eq('ip_address', clientIp)
      .single()

    // Check if user is admin
    let isAdmin = false
    if (user) {
      const { data: adminEntry } = await supabase
        .from('admin_users')
        .select('user_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single()
      isAdmin = !!adminEntry
    }

    // Get user tier (if applicable)
    let userTier: string | null = null
    if (user) {
      const { data: membership } = await supabase
        .from('member_membership')
        .select('tier')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single()
      userTier = membership?.tier || null
    }

    return NextResponse.json({
      appEnv: process.env.NEXT_PUBLIC_APP_ENV || 'unknown',
      userId: user?.id || null,
      userEmail: user?.email || null,
      userTier,
      isIpWhitelisted: !!whitelistEntry,
      isAdmin,
    })
  } catch (error) {
    console.error('[uat/env-info] Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
