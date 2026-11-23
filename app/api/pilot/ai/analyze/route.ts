import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/service'
import { looseRpc } from '@/lib/member/pilot-rpc'
import { analyzeHighlight, type HighlightInput } from '@/lib/pilot/ai'

export const dynamic = 'force-dynamic'
export const maxDuration = 15

// POST /api/pilot/ai/analyze — title + caption for a highlight. Needs a valid, unexpired /cam pairing code
// (so only staff-paired phones can spend AI quota). Always answers: if MiMo fails the reply has source "rules".
export async function POST(req: Request) {
  const body: unknown = await req.json().catch(() => null)
  if (typeof body !== 'object' || body === null) return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  const o = body as Record<string, unknown>
  const code = typeof o.code === 'string' ? o.code : ''
  if (!/^[0-9A-Za-z]{10}$/.test(code)) return NextResponse.json({ error: 'bad_request' }, { status: 400 })

  const status = await looseRpc(getServiceSupabase())('pilot_cam_status', { p_code: code })
  const ok = typeof status.data === 'object' && status.data !== null && (status.data as Record<string, unknown>).ok === true
  if (status.error || !ok) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const input: HighlightInput = {
    kind: typeof o.kind === 'string' ? o.kind.slice(0, 20) : 'manual',
    label: typeof o.label === 'string' ? o.label.slice(0, 40) : '',
    scoreA: typeof o.scoreA === 'number' ? Math.round(o.scoreA) : 0,
    scoreB: typeof o.scoreB === 'number' ? Math.round(o.scoreB) : 0,
    players: Array.isArray(o.players) ? o.players.filter((p): p is string => typeof p === 'string').slice(0, 4).map((p) => p.slice(0, 30)) : [],
    game: typeof o.game === 'string' ? o.game.slice(0, 20) : '',
  }
  return NextResponse.json(await analyzeHighlight(input))
}
