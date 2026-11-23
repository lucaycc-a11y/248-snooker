import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/service'
import { looseRpc } from '@/lib/member/pilot-rpc'
import { verifyClipVideo, videoMimeFor } from '@/lib/pilot/ai-video'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

// POST /api/pilot/clip/verify { code, path } — MiMo watches one uploaded clip once and records
// whether a ball was potted. Only the paired phone that uploaded the clip can trigger it.
export async function POST(req: Request) {
  const body: unknown = await req.json().catch(() => null)
  const o = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {}
  const code = typeof o.code === 'string' ? o.code : ''
  const path = typeof o.path === 'string' ? o.path : ''
  if (!/^[0-9A-Za-z]{10}$/.test(code) || !/^[0-9a-f-]{36}\/\d{6}\/[0-9a-f-]{36}\.(mp4|webm|mov)$/.test(path)) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }
  const supabase = getServiceSupabase()
  const rpc = looseRpc(supabase)
  const own = await rpc('pilot_clip_for_verify', { p_code: code, p_path: path })
  const ok = typeof own.data === 'object' && own.data !== null && (own.data as Record<string, unknown>).ok === true
  if (own.error || !ok) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const file = await supabase.storage.from('pilot-clips').download(path)
  if (file.error || !file.data) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  const mime = videoMimeFor(path, file.data.type)
  if (!mime) return NextResponse.json({ checked: false, reason: 'format' })

  const verdict = await verifyClipVideo(await file.data.arrayBuffer(), mime)
  if (!verdict) return NextResponse.json({ checked: false, reason: 'ai_unavailable' })
  await rpc('pilot_clip_set_ai', { p_path: path, p_potted: verdict.potted, p_desc: verdict.description })
  return NextResponse.json({ checked: true, potted: verdict.potted, description: verdict.description })
}
