import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/service'
import { looseRpc } from '@/lib/member/pilot-rpc'

export const dynamic = 'force-dynamic'

type Body = {
  code: string
  kind: string
  label: string
  matchKey: string
  scoreA: number
  scoreB: number
  players: string[]
  durationMs: number
  ext: string
}

function isBody(v: unknown): v is Body {
  if (typeof v !== 'object' || v === null) return false
  const o = v as Record<string, unknown>
  return (
    typeof o.code === 'string' && typeof o.kind === 'string' && typeof o.label === 'string' &&
    typeof o.matchKey === 'string' && typeof o.scoreA === 'number' && typeof o.scoreB === 'number' &&
    Array.isArray(o.players) && o.players.every((p) => typeof p === 'string') &&
    typeof o.durationMs === 'number' && typeof o.ext === 'string'
  )
}

function str(v: unknown): string | null {
  return typeof v === 'string' ? v : null
}

// POST /api/pilot/cam/upload — registers one clip (caps enforced in SQL) and returns a signed upload URL.
// The phone then uploads the video straight to the private pilot-clips bucket (12MB limit, mp4/webm only).
export async function POST(req: Request) {
  const body: unknown = await req.json().catch(() => null)
  if (!isBody(body) || !/^[0-9A-Za-z]{10}$/.test(body.code)) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }
  const supabase = getServiceSupabase()
  const { data, error } = await looseRpc(supabase)('pilot_clip_register', {
    p_code: body.code,
    p_kind: body.kind,
    p_label: body.label,
    p_match_key: body.matchKey,
    p_score_a: Math.round(body.scoreA),
    p_score_b: Math.round(body.scoreB),
    p_players: body.players.slice(0, 8).map((p) => p.slice(0, 40)),
    p_duration_ms: Math.round(body.durationMs),
    p_ext: body.ext,
  })
  if (error || typeof data !== 'object' || data === null) {
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
  const reg = data as Record<string, unknown>
  const path = str(reg.path)
  if (reg.ok !== true || !path) {
    return NextResponse.json({ error: str(reg.error) ?? 'rejected' }, { status: 409 })
  }
  const signed = await supabase.storage.from('pilot-clips').createSignedUploadUrl(path)
  if (signed.error || !signed.data) {
    return NextResponse.json({ error: 'sign_failed' }, { status: 500 })
  }
  return NextResponse.json({ path, token: signed.data.token, shareToken: str(reg.share_token) })
}
