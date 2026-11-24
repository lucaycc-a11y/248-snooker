import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { looseRpc } from '@/lib/member/pilot-rpc'

export const dynamic = 'force-dynamic'

// POST /api/member/pilot/matches
//   { action: 'hide', id }      — hide a match from the caller's OWN record (reversible)
//   { action: 'unhide_all' }    — restore everything the caller hid
//   { action: 'void', id }      — admin only (enforced in the database): remove a match from everyone's record
export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body: unknown = await req.json().catch(() => null)
  if (typeof body !== 'object' || body === null) return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  const o = body as Record<string, unknown>
  const action = o.action
  const id = typeof o.id === 'string' && /^[0-9a-f-]{36}$/i.test(o.id) ? o.id : null

  const rpc = looseRpc(supabase)
  if (action === 'unhide_all') {
    const { error } = await rpc('pilot_unhide_all_matches')
    if (error) return NextResponse.json({ error: 'internal' }, { status: 500 })
    return NextResponse.json({ ok: true })
  }
  if ((action === 'hide' || action === 'void') && id) {
    const { data, error } =
      action === 'hide'
        ? await rpc('pilot_hide_match', { p_match_id: id, p_hidden: true })
        : await rpc('pilot_admin_void_match', { p_match_id: id, p_void: true })
    if (error) {
      const forbidden = error.message.includes('FORBIDDEN')
      return NextResponse.json({ error: forbidden ? 'forbidden' : 'internal' }, { status: forbidden ? 403 : 500 })
    }
    const ok = typeof data === 'object' && data !== null && (data as Record<string, unknown>).ok === true
    return NextResponse.json({ ok })
  }
  return NextResponse.json({ error: 'bad_request' }, { status: 400 })
}
