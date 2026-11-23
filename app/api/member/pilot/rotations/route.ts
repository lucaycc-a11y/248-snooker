import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { looseRpc, parseRotations } from '@/lib/member/pilot-rpc'

export const dynamic = 'force-dynamic'

// GET /api/member/pilot/rotations — rotation (輪流賽) groups the signed-in member played in.
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
  const { data, error } = await looseRpc(supabase)('pilot_my_rotations', { p_limit: 10 })
  if (error) {
    console.error('[member/pilot/rotations] rpc failed', error.message)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
  return NextResponse.json(parseRotations(data))
}
