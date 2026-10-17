/**
 * POST /api/auth/risk-stamp
 *
 * Records one auth risk event for the currently signed-in member.
 * Called once from the login screen after a session is detected.
 *
 * The stamp is best-effort: a failure here never blocks a login.
 */

import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@/lib/supabase/route-handler'
import { stampAuthRiskEvent } from '@/lib/auth/risk-events'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const supabase = await createRouteHandlerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await stampAuthRiskEvent({
      userId: user.id,
      req,
      eventType: 'login',
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.warn('[auth/risk-stamp] failed', {
      message: err instanceof Error ? err.message : 'unknown',
    })
    // Never fail the login experience for a telemetry write.
    return NextResponse.json({ ok: true })
  }
}
