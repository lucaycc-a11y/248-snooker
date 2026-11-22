import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { looseRpc } from '@/lib/member/pilot-rpc'

export const dynamic = 'force-dynamic'

type JoinBody = { code?: unknown }

// POST /api/member/pilot/join { code }
// A friend scanned the QR on the iPad, then logged in or registered on their phone.
// This links their account to that table; the iPad picks it up within a couple of seconds.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as JoinBody | null
  const code = typeof body?.code === 'string' ? body.code.trim().toUpperCase() : ''
  if (!/^[A-Z0-9]{6,12}$/.test(code)) {
    return NextResponse.json({ error: 'bad_code' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { error } = await looseRpc(supabase)('pilot_complete_join', { p_code: code })
  if (error) {
    const message = error.message
    if (message.includes('EXPIRED')) return NextResponse.json({ error: 'expired' }, { status: 410 })
    if (message.includes('NOT_FOUND')) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    if (message.includes('ALREADY_USED')) return NextResponse.json({ error: 'already_used' }, { status: 409 })
    console.error('[member/pilot/join] rpc failed', message)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
