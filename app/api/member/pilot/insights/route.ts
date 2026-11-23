import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { looseRpc, parseInsights } from '@/lib/member/pilot-rpc'

export const dynamic = 'force-dynamic'

// GET /api/member/pilot/insights — rivals, monthly progress and yearly recap for the signed-in member.
// Admin-only beta: returns { enabled: false } for everyone else.
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { data, error } = await looseRpc(supabase)('pilot_my_insights')
  if (error) {
    console.error('[member/pilot/insights] rpc failed', error.message)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
  const insights = parseInsights(data)
  return NextResponse.json(insights ?? { enabled: false })
}
