import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceSupabase } from '@/lib/supabase/service'
import { looseRpc } from '@/lib/member/pilot-rpc'

export const dynamic = 'force-dynamic'

// "我的精華": the member's saved clips. Admin-only beta — `enabled` is false for everyone else.

async function authed() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  return error || !user ? null : supabase
}

export async function GET() {
  const supabase = await authed()
  if (!supabase) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data, error } = await looseRpc(supabase)('pilot_my_clips', { p_limit: 30 })
  if (error || typeof data !== 'object' || data === null) return NextResponse.json({ error: 'internal' }, { status: 500 })
  const d = data as Record<string, unknown>
  if (d.enabled !== true) return NextResponse.json({ enabled: false, clips: [] })
  const rows = Array.isArray(d.clips) ? d.clips : []
  const admin = getServiceSupabase()
  const clips = (
    await Promise.all(
      rows.map(async (r) => {
        if (typeof r !== 'object' || r === null) return null
        const o = r as Record<string, unknown>
        if (typeof o.storage_path !== 'string' || typeof o.id !== 'string') return null
        const signed = await admin.storage.from('pilot-clips').createSignedUrl(o.storage_path, 3600)
        if (signed.error || !signed.data) return null
        return {
          id: o.id, kind: o.kind, label: o.label, room: o.room_name, scoreA: o.score_a, scoreB: o.score_b,
          players: o.players, createdAt: o.created_at, expiresAt: o.expires_at, url: signed.data.signedUrl,
        }
      }),
    )
  ).filter((c) => c !== null)
  return NextResponse.json({ enabled: true, clips })
}

// POST { token } — save a clip (from the share-page QR) into the member's own list for 30 days.
export async function POST(req: Request) {
  const supabase = await authed()
  if (!supabase) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body: unknown = await req.json().catch(() => null)
  const token = typeof body === 'object' && body !== null ? (body as Record<string, unknown>).token : null
  if (typeof token !== 'string' || !/^[0-9a-f]{64}$/i.test(token)) return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  const { data, error } = await looseRpc(supabase)('pilot_claim_clip', { p_share_token: token })
  if (error || typeof data !== 'object' || data === null) return NextResponse.json({ error: 'internal' }, { status: 500 })
  const d = data as Record<string, unknown>
  return NextResponse.json({ enabled: d.enabled === true, saved: d.saved === true })
}

export async function DELETE(req: Request) {
  const supabase = await authed()
  if (!supabase) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const id = new URL(req.url).searchParams.get('id') ?? ''
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  const { error } = await looseRpc(supabase)('pilot_delete_clip', { p_id: id })
  return error ? NextResponse.json({ error: 'internal' }, { status: 500 }) : NextResponse.json({ ok: true })
}
