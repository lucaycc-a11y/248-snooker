import { NextResponse } from 'next/server'
import { getLegacyRouteHandlerClient } from '@/lib/supabase/legacy'
import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Body = { room?: unknown; session?: unknown }

// POST /api/pilot/complete-guest-join  { room, session }
// Called by /join after successful auth + profile completion.
// Marks the matching pending guest_join_requests row completed. Best-effort — never blocks signup.
export async function POST(request: Request) {
  const supabase = await getLegacyRouteHandlerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'not_authenticated' }, { status: 401 })

  const body = (await request.json().catch(() => null)) as Body | null
  const room = typeof body?.room === 'string' ? body.room : ''
  const session = typeof body?.session === 'string' ? body.session : ''
  if (!room || !session) return NextResponse.json({ ok: false })

  const service = getLegacyServiceSupabase()
  await service
    .from('guest_join_requests')
    .update({ status: 'completed', created_user_id: user.id })
    .eq('room_code', room)
    .eq('session_id', session)
    .eq('status', 'pending')

  return NextResponse.json({ ok: true })
}
