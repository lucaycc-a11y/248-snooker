import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/service'
import { looseRpc } from '@/lib/member/pilot-rpc'

export const dynamic = 'force-dynamic'

// GET /api/pilot/clip/<share token> — metadata + 1-hour signed URL for the phone share page (/c/<token>).
export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params
  if (!/^[0-9a-f]{64}$/i.test(token)) return NextResponse.json({ found: false }, { status: 404 })
  const supabase = getServiceSupabase()
  const { data, error } = await looseRpc(supabase)('pilot_clip_public', { p_token: token })
  if (error || typeof data !== 'object' || data === null) return NextResponse.json({ found: false }, { status: 500 })
  const row = data as Record<string, unknown>
  if (row.found !== true || typeof row.path !== 'string') return NextResponse.json({ found: false }, { status: 404 })
  const signed = await supabase.storage.from('pilot-clips').createSignedUrl(row.path, 3600)
  if (signed.error || !signed.data) return NextResponse.json({ found: false }, { status: 404 })
  return NextResponse.json({
    found: true,
    url: signed.data.signedUrl,
    kind: row.kind,
    label: row.label,
    room: row.room,
    scoreA: row.score_a,
    scoreB: row.score_b,
    players: row.players,
    expiresAt: row.expires_at,
    saved: row.saved,
  })
}
