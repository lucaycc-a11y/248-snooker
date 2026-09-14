// Dev2 Panel: Auth Log
// Returns recent authentication events from audit_log

import { NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { getServiceSupabase } from '@/lib/supabase/service'

export const runtime = 'edge'

export async function GET() {
  const admin = await getAdminData()
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const service = getServiceSupabase()

    // Query audit_log for auth-related events
    const { data: authEvents, error } = await service
      .from('audit_log')
      .select('*')
      .in('action', ['login', 'logout', 'otp_attempt', 'otp_success', 'otp_failure', 'signup'])
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) throw error

    return NextResponse.json({
      events: (authEvents || []).map((evt) => ({
        id: evt.id,
        timestamp: evt.created_at,
        action: evt.action,
        userIdentifier: evt.admin_email || evt.target_id,
        outcome: evt.after_value?.success ?? 'unknown',
        metadata: evt.after_value,
      })),
    })
  } catch (error) {
    console.error('[dev2/auth-log] error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
